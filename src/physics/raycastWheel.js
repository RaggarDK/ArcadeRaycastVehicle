import { Vector3, Quaternion } from '@babylonjs/core/maths/math.vector.js'
import { Axis } from '@babylonjs/core/maths/math.axis.js'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js'

class RaycastWheel{
    constructor(options){
        this.positionLocal = options.positionLocal.clone()
        this.positionWorld = options.positionLocal.clone()
        this.suspensionAxisLocal = options.suspensionAxisLocal.clone()
		this.suspensionAxisWorld = this.suspensionAxisLocal.clone()
		this.axleAxisLocal = options.axleAxisLocal.clone()
		this.forwardAxisLocal = options.forwardAxisLocal.clone()
		this.sideForce = options.sideForce || 40
		this.sideForcePositionRatio = options.sideForcePositionRatio || 0.1
        this.radius = options.radius || 0.2
		this.suspensionRestLength = options.suspensionRestLength || 0.5
		this.prevSuspensionLength = this.suspensionRestLength
        this.suspensionLength = this.suspensionRestLength
		this.suspensionForce = options.suspensionForce || 15000
		this.suspensionDamping = options.suspensionDamping || 0.1
		this.rotationMultiplier = options.rotationMultiplier || 0.1
		this.hitDistance = 0
		this.hitNormal = new Vector3()
		this.hitPoint = new Vector3()
		this.inContact = false
		
        this.steering = 0
		this.rotation = 0
        this.force = 0

        this.transform = new TransformNode("WheelTransform")
        this.transform.rotationQuaternion = new Quaternion()
    }
}

export default RaycastWheel