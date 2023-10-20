import { Vector3, Quaternion } from '@babylonjs/core/maths/math.vector.js'
import { Axis } from '@babylonjs/core/maths/math.axis.js'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js'

class RaycastWheel{
    constructor(options){
        this.positionLocal = options.positionLocal.clone()
        this.positionWorld = options.positionLocal.clone()
        this.wheelPositionWorld = options.positionLocal.clone()
        this.wheelDirectionWorld = options.positionLocal.clone()
		this.suspensionAxisLocal = options.suspensionAxisLocal?.clone() || new Vector3(0,-1,0)
		this.axleAxisLocal = options.axleAxisLocal?.clone() || new Vector3(1,0,0)
		this.forwardAxisLocal = options.forwardAxisLocal?.clone() || new Vector3(0,0,1)
		
		this.sideForcePositionRatio = options.sideForcePositionRatio || 0.1
        
        this.suspensionLength = options.suspensionLength
        this.suspensionStrength = options.suspensionStrength
        this.suspensionDamping = options.suspensionDamping
        this.suspensionRelaxation = options.suspensionRelaxation
		this.radius = 0.2
		
		this.hitDistance = 0
		this.hitNormal = new Vector3()
		this.hitPoint = new Vector3()
		this.inContact = false
		this.prevCompression = 0.6
        this.compressionDistance = 0.5
		this.compressionRestDistance = 0.6
        this.steering = 0
		this.rotation = 0
        this.force = 0

        this.transform = new TransformNode("WheelTransform")
        this.transform.rotationQuaternion = new Quaternion()
    }
}

export default RaycastWheel