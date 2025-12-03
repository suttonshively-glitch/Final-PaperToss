import {
  AssetType,
  createSystem,
  AudioSource, AudioUtils,
  Mesh,
  MeshBasicMaterial,
  DoubleSide,
  CanvasTexture,
  PlaneGeometry,
  BoxGeometry,
  SessionMode,
  SRGBColorSpace,
  AssetManager,
  World,
  SphereGeometry,
  MeshStandardMaterial,
  LocomotionEnvironment,
  EnvironmentType,
  PanelUI,
  Vector3,
  Interactable,
  ScreenSpace,
  OneHandGrabbable, DistanceGrabbable,
  PhysicsBody, PhysicsShape, PhysicsShapeType, PhysicsState, PhysicsSystem
} from '@iwsdk/core';


import { PanelSystem } from './panel.js';


const assets = {
  chimeSound: {
    url: '/audio/chime.mp3',
    type: AssetType.Audio,
    priority: 'background'
  },

  paperball: {                              
    url: '/glxf/paperball.glb',
    type: AssetType.GLTF,
    priority: 'critical',
  },

  paperbin: {                              
    url: '/glxf/paper_waste_bin.glb',
    type: AssetType.GLTF,
    priority: 'critical',
  },

};

World.create(document.getElementById('scene-container'), {
  assets,
  xr: {
    sessionMode: SessionMode.ImmersiveAR,
    offer: 'always',
    // Optional structured features; layers/local-floor are offered by default
    features: { handTracking: false, layers: false, localFloor: true } 
  },
  features: {grabbing: true, locomotion: false,},
  //level: '/glxf/Composition.glxf' 
}).then((world) => {
  const { camera } = world;
  
  world.registerSystem(PhysicsSystem).registerComponent(PhysicsBody).registerComponent(PhysicsShape);


  /////////////paper bin
  const bin = AssetManager.getGLTF('paperbin').scene;
  bin.position.set(0, .24, -2);
  bin.scale.set(0.007, 0.007, 0.007);
  const binEntity = world.createTransformEntity(bin);
  binEntity.addComponent(PhysicsShape, { shape: PhysicsShapeType.TriMesh,  density: 0.02,  friction: 0.5,  restitution: 0.3 });
  binEntity.addComponent(PhysicsBody, { state: PhysicsState.Static });
 

  /////////////mostly invis floor
  const floorGeometry = new BoxGeometry(10, 2, 10);
  const floorMaterial = new MeshStandardMaterial({
    color: 0xaaaaaa,       // base color (won't matter once opacity=0)
    transparent: true,     // allow transparency
    opacity: .1,            // fully invisible
  });
  const floorMesh = new Mesh(floorGeometry, floorMaterial);
  floorMesh.position.set(0,-1,0)
  const floorEntity = world.createTransformEntity(floorMesh);
  //floorEntity.addComponent(LocomotionEnvironment, { type: EnvironmentType.STATIC });
  floorEntity.addComponent(PhysicsShape, { shape: PhysicsShapeType.Auto});
  floorEntity.addComponent(PhysicsBody, { state: PhysicsState.Static });

  
  ////////////////paper ball
  const sphere = AssetManager.getGLTF('paperball').scene;
  sphere.position.set(0, 2, -.5);
  const sphereEntity = world.createTransformEntity(sphere);
  sphereEntity.addComponent(PhysicsShape, { shape: PhysicsShapeType.Sphere, dimensions: [0.05, 0, 0],  density: 0.2,  friction: 0.7,  restitution: 0.3 });
  sphereEntity.addComponent(PhysicsBody, { state: PhysicsState.Dynamic });
  sphereEntity.addComponent(Interactable).addComponent(DistanceGrabbable);

  sphereEntity.addComponent(LocomotionEnvironment, { type: EnvironmentType.LOCAL_FLOOR });


  /////////////////////////adding an indicator cube
  const cubeGeometry = new BoxGeometry(0.5, 0.5, 0.5);
  const cubeMaterial = new MeshStandardMaterial({ color: 'red' });
  const cubeMesh = new Mesh(cubeGeometry, cubeMaterial);
  cubeMesh.position.set(0, 5, -2);
  const cubeEntity = world.createTransformEntity(cubeMesh);

  //scoreboard
  // create a message board using a canvas texture (scoreBox)
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  ctx.font = 'bold 120px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = 'red';
  ctx.fillText('Score: 0', canvas.width / 2, canvas.height / 2 + 16);
  
  const texture = new CanvasTexture(canvas);
  const aspect = canvas.width / canvas.height;
  const boardWidth = 2;                 // world units
  const boardHeight = boardWidth / aspect;
  
  const boardMat = new MeshBasicMaterial({ 
    map: texture, 
    transparent: true,  
    side: DoubleSide,});

  const boardGeo = new PlaneGeometry(12, 1.5);
  const boardMesh = new Mesh(boardGeo, boardMat);
  const boardEntity = world.createTransformEntity(boardMesh);

  boardEntity.object3D.position.set(0, 5, -20);  // in front of the user
  boardEntity.object3D.visible = true; // start hidden
  boardEntity.object3D.rotation.set(0, Math.PI / 4, 0);
  boardEntity.object3D.lookAt(camera.position);


  let score = 0;
  function updateScoreboard() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (score > 0){
      ctx.font = 'bold 200px sans-serif';
      ctx.fillStyle = 'green';
      ctx.textAlign = 'center';
      ctx.fillText('YOU WIN!!!', canvas.width / 2, canvas.height / 2 + 50);
    } else {
      // Display regular score
      ctx.font = 'bold 200px sans-serif';
      ctx.fillStyle = 'red';
      ctx.textAlign = 'center';
      ctx.fillText(`Toss the ball into bin!`, canvas.width / 2, canvas.height / 2 + 40);
    }
      texture.needsUpdate = true;

  }
  updateScoreboard();


  //////////////////////////////win sound
  const musicEntity = world.createEntity();
  musicEntity.addComponent(AudioSource, {
  src: '/audio/marimba-win-b-3-209679.mp3',
  loop: false,
  volume: 1, 
  positional: false
  });

  ///////////////////crumple sound
  const papersoundEntity = world.createTransformEntity();
  papersoundEntity.object3D.position.set(0, 2, -.5);
  papersoundEntity.addComponent(AudioSource, {
  src: '/audio/newspaper-foley-4-196721.mp3',
  loop: false,
  volume: 1.0,
  positional: true
  });
  sphereEntity.object3D.add(papersoundEntity.object3D); // Attach sound to movingEntity

  sphere.addEventListener('pointerdown', (event) => {
    AudioUtils.play(papersoundEntity);
    // 'event.data.pointerId' can help identify which hand caused the event
  });



 //////////////////////////////////////////game loop
  let sphereExists = true;

  const GameLoopSystem = class extends createSystem() {
    update(delta, time) {
      if(sphereExists){
      if (
      sphereEntity.object3D.position.y < .11 &&
      sphereEntity.object3D.position.x > -.1 &&
      sphereEntity.object3D.position.x < .1 &&
      sphereEntity.object3D.position.z > -2.1 &&
      sphereEntity.object3D.position.z < -1.9) {
         
        AudioUtils.play(musicEntity); 
        //sphereEntity.destroy()
        sphereExists = false;
        score += 1
        updateScoreboard();
      
        }
        if(sphereEntity.object3D.position.z < -3 ||
          sphereEntity.object3D.position.z > 3 ||
          sphereEntity.object3D.position.x < -3 ||
          sphereEntity.object3D.position.x > 3 ||
          sphereEntity.object3D.position.y < -1
        ){
          cubeMesh.material.color.set('green');
          sphereEntity.object3D.position.set(0, .5, -.5);
        }

      }
      
    }
  };
  world.registerSystem(GameLoopSystem);
  


  // vvvvvvvv EVERYTHING BELOW WAS ADDED TO DISPLAY A BUTTON TO ENTER VR FOR QUEST 1 DEVICES vvvvvv
  //          (for some reason IWSDK doesn't show Enter VR button on Quest 1)
  world.registerSystem(PanelSystem);
  
  if (isMetaQuest1()) {
    const panelEntity = world
      .createTransformEntity()
      .addComponent(PanelUI, {
        config: '/ui/welcome.json',
        maxHeight: 0.8,
        maxWidth: 1.6
      })
      .addComponent(Interactable)
      .addComponent(ScreenSpace, {
        top: '20px',
        left: '20px',
        height: '40%'
      });
    panelEntity.object3D.position.set(0, 1.29, -1.9);
  } else {
    // Skip panel on non-Meta-Quest-1 devices
    // Useful for debugging on desktop or newer headsets.
    console.log('Panel UI skipped: not running on Meta Quest 1 (heuristic).');
  }
  function isMetaQuest1() {
    try {
      const ua = (navigator && (navigator.userAgent || '')) || '';
      const hasOculus = /Oculus|Quest|Meta Quest/i.test(ua);
      const isQuest2or3 = /Quest\s?2|Quest\s?3|Quest2|Quest3|MetaQuest2|Meta Quest 2/i.test(ua);
      return hasOculus && !isQuest2or3;
    } catch (e) {
      return false;
    }
  }







});