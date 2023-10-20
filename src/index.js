import { Vector3, Quaternion } from '@babylonjs/core/maths/math.vector.js'
import { Axis, Space } from '@babylonjs/core/maths/math.axis.js'
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js'
import { Engine } from '@babylonjs/core/Engines/engine.js'
import { Scene } from '@babylonjs/core/scene.js'
import "@babylonjs/core/Physics/physicsEngineComponent"

import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js'
import { FollowCamera } from '@babylonjs/core/Cameras/followCamera.js'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js'

import { KeyboardEventTypes } from '@babylonjs/core/Events/keyboardEvents.js'
import { HavokPlugin } from '@babylonjs/core/Physics/v2/Plugins/havokPlugin.js'
import { PhysicsShapeConvexHull, PhysicsShapeMesh } from '@babylonjs/core/Physics/v2/physicsShape.js'
import { PhysicsBody } from '@babylonjs/core/Physics/v2/physicsBody.js'

import '@babylonjs/core/Materials/Textures/Loaders/envTextureLoader.js'
import { CubeTexture } from '@babylonjs/core/Materials/Textures/cubeTexture.js'


import { PhysicsShapeType, PhysicsMotionType } from '@babylonjs/core/Physics/v2/IPhysicsEnginePlugin.js'

import { GLTFLoader } from "@babylonjs/loaders/glTF/2.0/glTFLoader.js"
import { SceneLoader } from '@babylonjs/core/Loading/sceneLoader.js'

import HavokPhysics from "@babylonjs/havok"
import RaycastVehicle from './physics/raycastVehicle.js'
import RaycastWheel from './physics/raycastWheel.js'

import { Sound } from '@babylonjs/core/Audio/sound.js'
import '@babylonjs/core/Audio/audioSceneComponent.js'

import { Animation } from '@babylonjs/core/Animations/animation.js'


const init = async () => {
	const canvas = document.getElementById("renderCanvas")
    const engine = new Engine(canvas, true)
	const scene = new Scene(engine)
	
	const camera = new FreeCamera("camera1", new Vector3(0, 5, -10), scene)
	camera.setTarget(Vector3.Zero())
	camera.attachControl(canvas, true)
	const light = new HemisphericLight("light", new Vector3(0, 1, 0), scene)
	light.intensity = 0.7

	//await scene.createDefaultEnvironment()
	const hdrTexture = CubeTexture.CreateFromPrefilteredData('environmentSpecular.env', scene);
	scene.environmentTexture = hdrTexture;
	
	//ACE snippetID 1CG7SN#5
	//const animations = await Animation.CreateFromSnippetAsync('1CG7SN#5')
	const animations = await Animation.ParseFromFileAsync("Vehicle", "curves/acceleration.json")
    const accelerationCurve = animations[0]
    const skidCurve = animations[1]

	const levelContainer = await SceneLoader.LoadAssetContainerAsync('./models/', 'ds01.gltf', scene)
	const levelFiles = levelContainer.instantiateModelsToScene(name => name, true)
	
	const vehicleContainer = await SceneLoader.LoadAssetContainerAsync('./models/', 'vehicleNS.gltf', scene)
	const vehicleFiles = vehicleContainer.instantiateModelsToScene(name => name, true)
	const vehicleMesh = vehicleFiles.rootNodes[0].getChildren()[0]
	vehicleMesh.scaling.set(1.2,1.2,1.2)
	const wheelMesh = vehicleFiles.rootNodes[0].getChildren()[1]
	wheelMesh.scaling.set(2.4,1.6,1.6)
	
	const HK = await HavokPhysics()
    const gravityVector = new Vector3(0, -9.81, 0)
    const physicsPlugin = new HavokPlugin(false, HK)
    scene.enablePhysics(gravityVector, physicsPlugin)
    const physicsEngine = scene.getPhysicsEngine()
	
	const levelRootNode = levelFiles.rootNodes[0]
	levelRootNode.scaling.set(.3,.3,.3)
	levelRootNode.computeWorldMatrix(true)
	
	const getMeshesByNameIncluded = (meshes, names) => {
		const result = []
		meshes.forEach(mesh => {
			names.forEach(name => {
				if(mesh.name.includes(name)) result.push(mesh)
			})
		})
		return result
	}
	const levelChildren = levelRootNode.getChildren()
	const staticGeom = getMeshesByNameIncluded(levelChildren, ['ground', 'side', 'pipe', 'ramp', 'rail', 'platform'])
	staticGeom.forEach(mesh => {
		mesh.computeWorldMatrix(true)
		const meshPhysicsShape = new PhysicsShapeMesh(
			mesh,
			scene
		)
		const meshPhysicsBody = new PhysicsBody(mesh, PhysicsMotionType.STATIC, false, scene);
		meshPhysicsBody.shape = meshPhysicsShape
		meshPhysicsShape.filterMembershipMask = 1
	})
	const dynamicGeom = getMeshesByNameIncluded(levelChildren, ['barrel', 'Box', 'cone'])
	dynamicGeom.forEach(mesh => {
		mesh.computeWorldMatrix(true)
		const meshPhysicsShape = new PhysicsShapeConvexHull(
			mesh,
			scene
		)
		const meshPhysicsBody = new PhysicsBody(mesh, PhysicsMotionType.DYNAMIC, true, scene);
		meshPhysicsBody.shape = meshPhysicsShape
		meshPhysicsBody.setMassProperties({
			mass: 10
		})
		meshPhysicsShape.filterMembershipMask = 1
	})
	
	
    const chassisMesh = MeshBuilder.CreateBox("Chassis", {width:1, height:0.4, depth:2})
	vehicleMesh.setParent(chassisMesh)
    chassisMesh.position.y = 5
    chassisMesh.position.x = 0
    chassisMesh.rotationQuaternion = new Quaternion()
	chassisMesh.visibility = 0

    const chassisPhysicsShape = new PhysicsShapeConvexHull(
		chassisMesh,
        scene
    )

    const chassisPhysicsBody = new PhysicsBody(chassisMesh, PhysicsMotionType.DYNAMIC, false, scene);
    chassisPhysicsBody.shape = chassisPhysicsShape
    chassisPhysicsBody.setMassProperties({
		centerOfMass: new Vector3(0, -0.5, 0)
    })
	chassisPhysicsShape.filterMembershipMask = 2
	
	const followCamera = new FollowCamera("FollowCam", new Vector3(-6, 0, 0), scene)
    followCamera.heightOffset = 1
    followCamera.radius = 5
    followCamera.rotationOffset = 180
    followCamera.cameraAcceleration = 0.08
    followCamera.maxCameraSpeed = 30
    followCamera.lockedTarget = chassisMesh
	scene.activeCamera = followCamera
	
	const vehicle = new RaycastVehicle(chassisPhysicsBody, scene)
	vehicle.numberOfFramesToPredict = 60//Number of frames to predict future upwards orientation if airborne
	vehicle.predictionRatio = 0.8//[0-1]How quickly to correct angular velocity towards future orientation. 0 = disabled
	
	const wheelConfig = {
		positionLocal:new Vector3(0.49, 0, -0.7),//Local connection point on the chassis
		suspensionRestLength:0.6, //Rest length when suspension is fully decompressed
		suspensionForce:15000, //Max force to apply to the suspension/spring 
		suspensionDamping:0.15, //[0-1] Damper force in percentage of suspensionForce
		suspensionAxisLocal:new Vector3(0,-1,0),//Direction of the spring
		axleAxisLocal:new Vector3(1,0,0),//Axis the wheel spins around
		forwardAxisLocal:new Vector3(0,0,1),//Forward direction of the wheel
		sideForcePositionRatio:0.1,//[0-1]0 = wheel position, 1 = connection point 
		sideForce:40,//Force applied to counter wheel drifting
		radius:0.2,
		rotationMultiplier:0.1//How fast to spin the wheel
	}

	vehicle.addWheel(new RaycastWheel(wheelConfig))//Right rear

	wheelConfig.positionLocal.set(-0.49, 0, -0.7)//Left rear
	vehicle.addWheel(new RaycastWheel(wheelConfig))
	
	wheelConfig.positionLocal.set(-0.49, 0, 0.8)
	vehicle.addWheel(new RaycastWheel(wheelConfig))//Left front
	
	wheelConfig.positionLocal.set(0.49, 0, 0.8)
	vehicle.addWheel(new RaycastWheel(wheelConfig))//Right front
	
	//Attempt at some anti rolling
	vehicle.addAntiRollAxle({wheelA:0,wheelB:1,force:10000}) // right rear - left rear
	vehicle.addAntiRollAxle({wheelA:2,wheelB:3,force:10000}) // left front - right rear
	
	
	const wheelMeshes = [wheelMesh.createInstance(0),wheelMesh.createInstance(1),wheelMesh.createInstance(2),wheelMesh.createInstance(3)]
	
	const revSound = new Sound("rev", "/sounds/med_on.wav", scene, null, {
        loop: true,
        autoplay: true,
        playbackRate:1,
        volume:0.3
    })
	
	const shiftSound = new Sound("shift", "/sounds/shift_1.wav", scene, null, {
        loop: false,
        autoplay: false,
        playbackRate:1,
        volume:0.8
     });

	const controls = {
		forward:false,
		backward:false,
		left:false,
		right:false
	}
		
	scene.onKeyboardObservable.add((kbInfo) => {
		switch (kbInfo.type) {
			case KeyboardEventTypes.KEYDOWN:
			if(kbInfo.event.key == 'w') controls.forward = true
			if(kbInfo.event.key == 's') controls.backward = true
			if(kbInfo.event.key == 'a') controls.left = true
			if(kbInfo.event.key == 'd') controls.right = true
			break
			case KeyboardEventTypes.KEYUP:
			if(kbInfo.event.key == 'w') controls.forward = false
			if(kbInfo.event.key == 's') controls.backward = false
			if(kbInfo.event.key == 'a') controls.left = false
			if(kbInfo.event.key == 'd') controls.right = false
			break
		}
    })
	
	const maxVehicleSpeed = 60
	const maxVehicleForce = 2200
	const numberOfGears = 5	
	const maxSteerValue = 0.6 
    const steeringIncrement = 0.005
    const steerRecover = 0.05
	let currentGear = 0	
	let vehicleAirborne = false
	let steering = 0
    let force = 0
	let forwardForce = 0
    let steerValue = 0
    let steerDirection = 0
   

    
	
	revSound.play()
	scene.onBeforeRenderObservable.add(()=>{
		forwardForce = 0
        steerDirection = 0
		if(controls.forward) forwardForce = 1
        if(controls.backward) forwardForce = -1
        if(controls.left) steerDirection = -1
        if(controls.right) steerDirection = 1
      
        steerValue += steerDirection*steeringIncrement
        steerValue = Math.min(Math.max(steerValue, -maxSteerValue), maxSteerValue)
        steerValue *= 1-(1-Math.abs(steerDirection))*steerRecover
		vehicle.wheels[2].steering = steerValue
		vehicle.wheels[3].steering = steerValue

		
		const speed = Math.min(Math.abs(vehicle.speed), maxVehicleSpeed)
        const prog = (speed/maxVehicleSpeed)*100
        const acceleration = accelerationCurve.evaluate(prog)
        const force2 = acceleration*forwardForce*maxVehicleForce
		
		vehicle.wheels[2].force = force2
		vehicle.wheels[3].force = force2
		
		/*
		const slip = skidCurve.evaluate(prog)
        const slipForce = 40-(slip*10)
		
		vehicle.wheels[0].sideForce = slipForce
		vehicle.wheels[1].sideForce = slipForce
		*/

		vehicle.update()
		
		vehicle.wheels.forEach((wheel, index) => {
			if(!wheelMeshes[index]) return
			const wheelMesh = wheelMeshes[index]
			wheelMesh.position.copyFrom(wheel.transform.position)
			wheelMesh.rotationQuaternion.copyFrom(wheel.transform.rotationQuaternion)
			if(index == 0 || index == 3) wheelMesh.rotate(Axis.Y, Math.PI, Space.LOCAL)
		})
		const maxSpeedSound = Math.min(Math.abs(vehicle.speed), maxVehicleSpeed)
		const gearProgression = maxSpeedSound/(maxVehicleSpeed/numberOfGears) % maxVehicleSpeed
		const currentGearNumber = Math.floor(gearProgression)
		const gearRatio = gearProgression-currentGearNumber
		revSound.setPlaybackRate((currentGearNumber/numberOfGears)+1.2*gearRatio)
		if(currentGear !== currentGearNumber){
			currentGear = currentGearNumber
			shiftSound.play()
		}
	})

	engine.runRenderLoop(()=>{
		scene.render()
	})
}

init()