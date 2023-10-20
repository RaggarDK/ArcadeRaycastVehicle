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
	
	const animations = await Animation.CreateFromSnippetAsync('1CG7SN#3')
    const accelerationCurve = animations[0]
    const skidCurve = animations[1]

	const levelContainer = await SceneLoader.LoadAssetContainerAsync('./models/', 'ds01.gltf', scene)
	const levelFiles = levelContainer.instantiateModelsToScene(name => name, true)
	
	const vehicleContainer = await SceneLoader.LoadAssetContainerAsync('./models/', 'vehicleNS.gltf', scene)
	const vehicleFiles = vehicleContainer.instantiateModelsToScene(name => name, true)
	console.log(vehicleFiles)
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
	levelRootNode.getChildren().forEach(child => {
		child.computeWorldMatrix(true)
			const childPhysicsShape = new PhysicsShapeMesh(
			child,   // mesh from which to calculate the collisions
			scene   // scene of the shape
		);
		const childPhysicsBody = new PhysicsBody(child, PhysicsMotionType.STATIC, false, scene);
		childPhysicsBody.shape = childPhysicsShape
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
	
	const followCamera = new FollowCamera("FollowCam", new Vector3(-6, 0, 0), scene)
    followCamera.heightOffset = 1
    followCamera.radius = 5
    followCamera.rotationOffset = 180
    followCamera.cameraAcceleration = 0.08
    followCamera.maxCameraSpeed = 30
    followCamera.lockedTarget = chassisMesh
	scene.activeCamera = followCamera
	
	const vehicle = new RaycastVehicle(chassisPhysicsBody, scene)
	
	const wheelpositionLocal = new Vector3(0.49, 0, -0.7)
    
    const suspensionRelaxation = 0.025
    const suspensionStrength = 8000
	const suspensionDamping = 0.9

	vehicle.addWheel(new RaycastWheel({
		positionLocal:wheelpositionLocal,
		suspensionLength:0.6,
		suspensionStrength:suspensionStrength,
		suspensionDamping:suspensionDamping,
		suspensionRelaxation:suspensionRelaxation
	}))

	wheelpositionLocal.set(-0.49, 0, -0.7)
	vehicle.addWheel(new RaycastWheel({
		positionLocal:wheelpositionLocal,
		suspensionLength:0.6,
		suspensionStrength:suspensionStrength,
		suspensionDamping:suspensionDamping,
		suspensionRelaxation:suspensionRelaxation
	}))
	wheelpositionLocal.set(-0.49, 0, 0.8)
	vehicle.addWheel(new RaycastWheel({
		positionLocal:wheelpositionLocal,
		suspensionLength:0.6,
		suspensionStrength:suspensionStrength,
		suspensionDamping:suspensionDamping,
		suspensionRelaxation:suspensionRelaxation
	}))
	wheelpositionLocal.set(0.49, 0, 0.8)
	vehicle.addWheel(new RaycastWheel({
		positionLocal:wheelpositionLocal,
		suspensionLength:0.6,
		suspensionStrength:suspensionStrength,
		suspensionDamping:suspensionDamping,
		suspensionRelaxation:suspensionRelaxation
	}))
	
	
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
		
	let currentGear = 0	
	let vehicleAirborne = false
	let steering = 0
    let force = 0
	revSound.play()
	scene.onBeforeRenderObservable.add(()=>{
		if(controls.left){
			steering -= 0.009
		} else if(controls.right) {
			steering += 0.009
		} else {
			steering *= 0.95
		}
		if(steering > 1) steering = 1
		if(steering < -1) steering = -1
		vehicle.wheels[2].steering = steering
		vehicle.wheels[3].steering = steering

		if(controls.forward) {
			force += 0.02
		} else if(controls.backward){
			force += -0.02
		} else {
			force *= 0.95
		}
		if(force > 1) force = 1
		if(force < -1) force = -1
		
		let speed = Math.abs(vehicle.speed)
        speed = Math.min(speed, 50)
        const prog = (speed/50)*100
        const acceleration = accelerationCurve.evaluate(prog)
        const force2 = acceleration*force*4600
		
		vehicle.wheels[2].force = force2
		vehicle.wheels[3].force = force2

		vehicle.update()
		
		vehicle.wheels.forEach((wheel, index) => {
			if(!wheelMeshes[index]) return
			const wheelMesh = wheelMeshes[index]
			wheelMesh.position.copyFrom(wheel.transform.position)
			wheelMesh.rotationQuaternion.copyFrom(wheel.transform.rotationQuaternion)
			if(index == 0 || index == 3) wheelMesh.rotate(Axis.Y, Math.PI, Space.LOCAL)
		})
		const maxSpeed = 50
		const numberOfGears = 4
		const maxSpeedSound = Math.min(Math.abs(vehicle.speed), 50)
		const gearProgression = maxSpeedSound/(maxSpeed/numberOfGears) % maxSpeed
		const currentGearNumber = Math.floor(gearProgression)
		const gearRatio = gearProgression-currentGearNumber
		revSound.setPlaybackRate((currentGearNumber/numberOfGears)+1.2*gearRatio)
		if(currentGear !== currentGearNumber){
			currentGear = currentGearNumber
			shiftSound.play()
			console.log("Shift")
		}
	})

	engine.runRenderLoop(()=>{
		scene.render()
	})
}

init()