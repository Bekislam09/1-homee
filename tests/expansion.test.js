import test from 'node:test';import assert from 'node:assert/strict';
import {Simulation} from '../src/smash/simulation.js';import {MISSIONS,VEHICLES} from '../src/smash/content.js';import {Progression} from '../src/smash/progression.js';import {driveDistrict} from './helpers/drive.js';
const step=(s,n,input={})=>{const events=[];for(let i=0;i<n;i++){s.update(1/60,input);events.push(...s.events);}return events;};
test('steering follows a bounded angular speed and Space cannot snap the facing direction',()=>{
 const s=new Simulation().start();Object.assign(s.player,{x:500,y:65});
 s.update(1/60,{x:1});assert(s.player.speed>0&&s.player.speed<20);
 for(let n=0;n<30;n++){const before=s.player.heading;s.update(1/60,{y:1});assert(Math.abs(s.player.heading-before)<=s.vehicle.turnRate/60+1e-8);}
 assert(Math.abs(s.player.heading-Math.PI/2)<1e-8);const before=s.player.heading;
 s.update(1/60,{x:-1,ramPressed:true});assert.equal(s.player.heading,before);
});
test('velocity reversals and released controls decelerate instead of jumping',()=>{
 const s=new Simulation().start();Object.assign(s.player,{x:500,y:65});step(s,30,{x:1});const before=s.player.vx;
 s.update(1/60,{x:-1});assert(s.player.vx>0&&s.player.vx<before);step(s,60);assert.equal(s.player.speed,0);
});
test('a tap within the final 150ms of cooldown starts once as soon as the ability is ready',()=>{
 const s=new Simulation().start({vehicleId:'excavator'});assert(s.useRam());step(s,148);
 assert(s.player.ramCooldown>0&&s.player.ramCooldown<.15);
 s.update(1/60,{ramPressed:true});assert(!s.events.some(e=>e.type==='ability-start'));
 const events=step(s,10);assert.equal(events.filter(e=>e.type==='ability-start').length,1);
 assert(s.player.ramTime>0);assert.equal(step(s,180).filter(e=>e.type==='ability-start').length,0);
});
test('early presses expire and holding a buffered press never repeats the ability',()=>{
 const early=new Simulation().start({vehicleId:'excavator'});assert(early.useRam());step(early,140);
 assert(early.player.ramCooldown>.15);early.update(1/60,{ramPressed:true});
 assert.equal(step(early,180).filter(e=>e.type==='ability-start').length,0);
 const held=new Simulation().start({vehicleId:'excavator'});assert(held.useRam());step(held,148);
 held.update(1/60,{ram:true});
 assert.equal(step(held,360,{ram:true}).filter(e=>e.type==='ability-start').length,1);
});
test('pending ability presses cannot leak through a restart or a block transition',()=>{
 const pending=()=>{
  const s=new Simulation().start({vehicleId:'excavator'});s.useRam();step(s,148);s.update(1/60,{ramPressed:true});
  assert(s._abilityBuffer>0);return s;
 };
 const restarted=pending();restarted.start({vehicleId:'excavator'});
 assert.equal(restarted._abilityBuffer,0);assert.equal(step(restarted,180).filter(e=>e.type==='ability-start').length,0);
 const transitioned=pending();transitioned._sectorWait=.05;
 const events=step(transitioned,180);assert.equal(transitioned.sector,1);assert.equal(transitioned._abilityBuffer,0);
 assert.equal(events.filter(e=>e.type==='ability-start').length,0);
});
test('clearing a buffered press before pausing prevents an attack on resume',()=>{
 const s=new Simulation().start({vehicleId:'excavator'});s.useRam();step(s,148);s.update(1/60,{ramPressed:true});
 assert(s._abilityBuffer>0);const before={...s.player};
 s.cancelBufferedAbility();assert.equal(s._abilityBuffer,0);assert.deepEqual(s.player,before);
 // Pausing does not tick the simulation. Once updates resume, the old tap
 // must not fire; a fresh deliberate press still works normally.
 assert.equal(step(s,20).filter(e=>e.type==='ability-start').length,0);
 s.update(1/60,{ramPressed:true});assert.equal(s.events.filter(e=>e.type==='ability-start').length,1);
});
const fixture=(id,x,y)=>({id,x,y,w:30,d:30,type:'house',hp:10,maxHp:10,points:100,reward:25,hitCooldown:0,lastRam:-1});
test('road roller affects nearby structures once at drum impact and leaves distant buildings intact',()=>{
 const s=new Simulation().start({vehicleId:'roller'});s.buildings=[fixture('a',145,150),fixture('b',145,210),fixture('far',400,180)];s.useRam();
 const before=step(s,28);assert(!before.some(e=>e.type==='hit'));const events=step(s,35);
 assert.equal(events.filter(e=>e.type==='ability-impact').length,1);assert.deepEqual(s.buildings.map(b=>b.hp),[8,8,10]);
});
test('breaker delivers three distinct timed strikes and cannot hit through its locked target',()=>{
 const s=new Simulation().start({vehicleId:'drill'});s.buildings=[fixture('near',165,180),fixture('behind',205,180)];s.useRam();
 const events=step(s,70);assert.equal(events.filter(e=>e.type==='ability-impact').length,3);
 assert.equal(events.filter(e=>e.type==='hit').length,3);assert(Math.abs(s.buildings[0].hp-4.6)<1e-8);assert.equal(s.buildings[1].hp,10);
});
test('new blocks have distinct destruction IDs and one final settlement for the entire contract',()=>{
 const s=new Simulation().start(),p=new Progression();const destroyedIds=[];
 driveDistrict(s,{tick:input=>{s.update(1/60,input);p.observeEvents(s.runId,s.events);destroyedIds.push(...s.events.filter(e=>e.type==='destroy').map(e=>e.buildingId));}});
 assert.equal(new Set(destroyedIds).size,destroyedIds.length);assert.equal(p.state.stats.destroyed,s.destroyed);
 p.state.balance=s.balance;assert(p.completeRun(s.result()).applied);const balance=p.state.balance;
 assert(!p.completeRun(s.result()).applied);assert.equal(p.state.balance,balance);
});
test('existing owned machines and four completed levels survive expansion to twelve contracts',()=>{
 const p=new Progression({version:3,balance:4321,ownedVehicles:['dozer','excavator','wrecker'],selectedVehicle:'wrecker',completedLevels:[1,2,3,4],achievements:['collector','champion']});
 assert.equal(p.state.balance,4321);assert.equal(p.state.selectedVehicle,'wrecker');assert(p.isLevelUnlocked(5));assert(!p.isLevelUnlocked(6));
 assert.deepEqual(p.state.achievements,['collector','champion'],'previously earned badges are retained');
 assert.equal(MISSIONS.length,12);assert.equal(Object.keys(VEHICLES).length,5);
 assert.deepEqual(Object.values(VEHICLES).map(v=>v.price),[0,1200,3000,6000,10000]);
});

test('remixed blocks use collapse behavior belonging to their current building type',()=>{
 for(const mission of MISSIONS){
  const s=new Simulation().start({missionId:mission.id});
  for(let sector=0;sector<mission.sectors;sector++){
   s.sector=sector;s._loadBuildings();
   for(const b of s.buildings){
    assert.equal(b.collapseRadius,['warehouse','containers'].includes(b.type)?190:undefined,`${mission.id}/${sector}/${b.id}`);
    assert.equal(b.fallHeading,b.type==='tower'?0:undefined);
   }
  }
 }
});
