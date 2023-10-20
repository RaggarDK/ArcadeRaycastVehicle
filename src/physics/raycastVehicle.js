import { Vector3, Quaternion } from '@babylonjs/core/maths/math.vector.js'
import { Axis } from '@babylonjs/core/maths/math.axis.js'
import { PhysicsRaycastResult } from '@babylonjs/core/physics/physicsRaycastResult.js'
import { getBodyVelocityAtPoint, clampNumber } from '../utils/utils.js'

const tmp1 = new Vector3()
const tmp2 = new Vector3()
const tmpq1 = new Quaternion()
const upAxisLocal = new Vector3(0,1,0)
const rightAxisLocal = new Vector3(1,0,0)
const forwardAxisLocal = Vector3.Cross(upAxisLocal, rightAxisLocal)
forwardAxisLocal.normalize()
rightAxisLocal.normalize()

const raycastResult = new PhysicsRaycastResult();
class RaycastVehicle{
    constructor(body, scene){
        this.body = body
		this.scene = scene
        this.physicsEngine = body._physicsEngine
        this.wheels = []
		this.numberOfFramesToPredict = 60
		this.predictionRatio = 0.6
        this.nWheelsOnGround = 0
		this.speed = 0
		this.axles = [
			{
				wheelA:0,
				wheelB:1,
				force:10000
			},
			{
				wheelA:2,
				wheelB:3,
				force:10000
			}
		]
    }

    addWheel(wheel){
        this.wheels.push(wheel)
    }
	
	updateWheelTransform(wheel){
		Vector3.TransformCoordinatesToRef(wheel.positionLocal, this.body.transformNode.getWorldMatrix(), wheel.positionWorld)
        Vector3.TransformNormalToRef(wheel.suspensionAxisLocal, this.body.transformNode.getWorldMatrix(), wheel.wheelDirectionWorld)
	}
	
	updateVehicleSpeed(){
		Vector3.TransformNormalToRef(this.body.getLinearVelocity(), this.body.transformNode.getWorldMatrix().clone().invert(), tmp1)
		this.speed = tmp1.z
	}
	
	updateWheelSteering(wheel){
		Quaternion.RotationAxisToRef(wheel.suspensionAxisLocal.negateToRef(tmp1), wheel.steering, tmpq1)
		this.body.transformNode.rotationQuaternion.multiplyToRef(tmpq1, wheel.transform.rotationQuaternion)
		wheel.transform.rotationQuaternion.normalize()
		wheel.transform.computeWorldMatrix(true)
	}
	
	updateWheelRaycast(wheel){
		tmp1.copyFrom(wheel.wheelDirectionWorld).scaleInPlace(wheel.compressionRestDistance).addInPlace(wheel.positionWorld)
		const rayStart = wheel.positionWorld
		const rayEnd = tmp1
		this.physicsEngine.raycastToRef(rayStart, rayEnd, raycastResult)
		if(!raycastResult.hasHit){
			wheel.inContact = false
			return
		}
		wheel.hitPoint.copyFrom(raycastResult.hitPointWorld)
		wheel.hitNormal.copyFrom(raycastResult.hitNormalWorld)
		wheel.hitDistance = raycastResult.hitDistance
		wheel.inContact = true
		this.nWheelsOnGround++
	}
	
	updateWheelSuspension(wheel){
		if(!wheel.inContact){
			wheel.prevCompression = wheel.compressionDistance
			wheel.hitDistance = wheel.compressionRestDistance
			return
		}
	  
		let force = 0.0
		wheel.compressionDistance = wheel.compressionRestDistance - wheel.hitDistance
		wheel.compressionDistance = clampNumber(wheel.compressionDistance, 0, wheel.compressionRestDistance);
		const compressionRatio = wheel.compressionDistance / wheel.compressionRestDistance;

		const compressionForce = 15000 * compressionRatio;
		force += compressionForce;

		const rate = (wheel.prevCompression - wheel.compressionDistance) / this.scene.getPhysicsEngine().getTimeStep()
		wheel.prevCompression = wheel.compressionDistance;

		const dampingForce = rate * 15000 * 0.15;
		force -= dampingForce;

		const suspensionForce = Vector3.TransformNormalToRef(wheel.suspensionAxisLocal.negateToRef(tmp1), this.body.transformNode.getWorldMatrix(), tmp1).scaleInPlace(force)

		this.body.applyForce(
			suspensionForce,
			wheel.hitPoint
		)
	}
	
	updateWheelSideForce(wheel){
		if(!wheel.inContact) return
		const tireWorldVel = getBodyVelocityAtPoint(this.body, wheel.positionWorld)
		const steeringDir = Vector3.TransformNormalToRef(wheel.axleAxisLocal, wheel.transform.getWorldMatrix(), tmp1)
		const steeringVel = Vector3.Dot(steeringDir, tireWorldVel)
		const desiredVelChange = -steeringVel * 1
		const desiredAccel = desiredVelChange / this.scene.getPhysicsEngine().getTimeStep()
		this.body.applyForce(
			steeringDir.scaleInPlace(40 * desiredAccel), 
			Vector3.LerpToRef(wheel.hitPoint, wheel.positionWorld, wheel.sideForcePositionRatio, tmp2)
		)
	}
	
	updateWheelForce(wheel){
		if(!wheel.inContact) return
		if(wheel.force !== 0){
			const forwardDirectionWorld = Vector3.TransformNormalToRef(wheel.forwardAxisLocal, wheel.transform.getWorldMatrix(), tmp1).scaleInPlace(wheel.force)
			this.body.applyForce(forwardDirectionWorld, tmp2.copyFrom(wheel.hitPoint).addInPlace(new Vector3(0,-0.8,.1)))
		}
	}
	
	updateWheelRotation(wheel){
		wheel.rotation += this.speed*0.1*wheel.radius
		Quaternion.RotationAxisToRef(wheel.axleAxisLocal, wheel.rotation, tmpq1)
		wheel.transform.rotationQuaternion.multiplyToRef(tmpq1, wheel.transform.rotationQuaternion)
		wheel.transform.rotationQuaternion.normalize()
	}
	
	updateWheelTransformPosition(wheel){
		wheel.transform.position.copyFrom(wheel.positionWorld)
		wheel.transform.position.addInPlace(wheel.wheelDirectionWorld.scale(wheel.hitDistance-wheel.radius))
	}
	
	updateVehiclePredictiveLanding(){
		if(this.nWheelsOnGround > 0) return
		const position = this.body.transformNode.position
		const gravity = tmp1.copyFrom(this.physicsEngine.gravity).scaleInPlace(this.body.getGravityFactor())
		const frameTime = this.scene.getPhysicsEngine().getTimeStep()
		const predictTime = this.numberOfFramesToPredict*frameTime
		
		const predictedPosition = tmp2
		predictedPosition.copyFrom(this.body.getLinearVelocity()).scaleInPlace(predictTime)
		predictedPosition.addInPlace(gravity.scaleInPlace(0.5*predictTime*predictTime))
		predictedPosition.addInPlace(this.body.transformNode.position)
		
		this.physicsEngine.raycastToRef(position, predictedPosition, raycastResult);
	  
		if (raycastResult.hasHit) {
			const velocity = this.body.getLinearVelocity().normalize()
			const direction = raycastResult.hitPointWorld.subtractToRef(position, tmp1)
			const displacement = tmp2
			displacement.x = velocity.x==0?0:direction.x/velocity.x
			displacement.y = velocity.y==0?0:direction.y/velocity.y
			displacement.z = velocity.z==0?0:direction.z/velocity.z
			const nFrames = displacement.length()
			const R1 = Vector3.TransformNormalToRef(Axis.Y, this.body.transformNode.getWorldMatrix(), tmp1)
			const R2 = raycastResult.hitNormalWorld
			const rotationDifference = Vector3.CrossToRef(R1, R2, tmp2)
			const timeStepDuration = frameTime*nFrames
			const predictedAngularVelocity = rotationDifference.scaleToRef(1 / timeStepDuration, tmp2)

			this.body.setAngularVelocity(Vector3.LerpToRef(this.body.getAngularVelocity(), predictedAngularVelocity, this.predictionRatio, tmp1))
		}
        
	}

    update(){
        this.body.transformNode.computeWorldMatrix(true)
        this.nWheelsOnGround = 0
		this.updateVehicleSpeed()
		
		this.wheels.forEach((wheel, index) => {
			this.updateWheelTransform(wheel)
			this.updateWheelSteering(wheel)
			this.updateWheelRaycast(wheel)
			this.updateWheelSuspension(wheel)
			this.updateWheelForce(wheel)
			this.updateWheelSideForce(wheel)
			this.updateWheelTransformPosition(wheel)
			this.updateWheelRotation(wheel)
		})
		
		this.updateVehiclePredictiveLanding()
		
		this.axles.forEach(axle => {
			const wheelA = this.wheels[axle.wheelA]
			const wheelB = this.wheels[axle.wheelB]
			if(!wheelA || !wheelB) return
			if(!wheelA.inContact && !wheelB.inContact) return
			const wheelOrder = wheelA.compressionDistance <= wheelB.compressionDistance ? [wheelA, wheelB] : [wheelB, wheelA]
			const maxCompressionRestLength = (wheelA.compressionRestDistance+wheelB.compressionRestDistance)/2
			const compressionDifference = wheelOrder[1].compressionDistance-wheelOrder[0].compressionDistance
			const compressionRatio = Math.min(compressionDifference,maxCompressionRestLength)/maxCompressionRestLength
			
			const antiRollForce = tmp1.copyFrom(wheelOrder[0].wheelDirectionWorld).scaleInPlace(axle.force*compressionRatio)
			this.body.applyForce(
                antiRollForce, 
                wheelOrder[0].positionWorld
            )
			antiRollForce.copyFrom(wheelOrder[1].wheelDirectionWorld).negateInPlace().scaleInPlace(axle.force*compressionRatio)
			this.body.applyForce(
                antiRollForce, 
                wheelOrder[1].positionWorld
            )
		})
		
    }


}




export default RaycastVehicle