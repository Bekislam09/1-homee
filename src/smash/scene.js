import Phaser from 'phaser';
import { iso, createTextures, drawGround, createDecor, ART_ANCHOR, getVehicleTextureOffset,vehiclePose } from './art.js';
import { t } from './i18n.js';

const FRAGMENT_COLORS = {
  shed: [0xffdf9a, 0xf4bc80, 0xe9d6ad],
  kiosk: [0xf5b899, 0xffe3a6, 0xc5dbce],
  house: [0xf1cbbb, 0xe1e5c5, 0xbacfd9],
  warehouse: [0xd9ad89, 0xf4d7b0, 0xa4c4c4],
  tower: [0xe9bb99, 0xc9b9a6, 0xf1d7ad],
  containers: [0xa4c8c0, 0xe9be8b, 0xa6c4d3],
};

export class CityScene extends Phaser.Scene {
  constructor(simulation, controls) {
    super('City');
    this.sim = simulation;
    this.controls = controls;
    this.accumulator = 0;
    this.elapsed = 0;
    this.effectIndex = 0;
    this.labelIndex = 0;
    this.follow = { x: 0, y: 500 };
    this.frameInput = {x: 0, y: 0, ram: false, ramPressed: false};
  }

  create() {
    createTextures(this);
    this.ground = drawGround(this);
    this.decor = createDecor(this);
    this.buildings = this.sim.buildings.map(b => {
      const p = iso(b.x, b.y);
      return {
        view: this.add.image(p.x, p.y + ART_ANCHOR.building, `${b.type}-0`).setOrigin(.5, 1).setDepth(b.x + b.y),
        health: this.add.graphics().setDepth(b.x + b.y + .5),
        collapse: this.add.image(p.x, p.y + ART_ANCHOR.building, `${b.type}-2`).setOrigin(.5, 1).setDepth(b.x+b.y+2).setVisible(false),
        collapseTime: 0,
        hp: b.maxHp, shake: 0, dead: false
      };
    });
    this.shadow = this.add.ellipse(0, 0, 74, 31, 0x25443d, .16);
    this.dozer = this.add.image(0, 0, 'dozer-0').setOrigin(.5, 1);
    this.attackArea = this.add.ellipse(0,0,20,12,0xf5c864,.12).setStrokeStyle(2,0xd89943,.7).setVisible(false);
    this.particles = Array.from({ length: 100 }, () => ({
      view: this.add.image(0, 0, 'dust').setVisible(false), life: 0,
      x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, max: 1, size: 1
    }));
    this.labels = Array.from({ length: 16 }, () => ({
      view: this.add.text(0, 0, '', { fontFamily: 'Arial, sans-serif', fontSize: '24px', fontStyle: 'bold', color: '#fff6d4', stroke: '#254b45', strokeThickness: 5 }).setOrigin(.5, 1).setDepth(5000).setVisible(false), life: 0, y: 0
    }));
    this.scale.on('resize', this.layout, this);
    this.events.once('shutdown', () => this.scale.off('resize', this.layout, this));
    this.layout();
    this.controls.onReady?.(this);
  }

  layout() {
    if (!this.cameras) return;
    const { width: w, height: h } = this.scale;
    const menu = this.controls.screen === 'menu';
    const camera = this.cameras.main;
    if (menu && w > 760) {
      camera.setViewport(w * .35, 78, w * .65, h - 160);
      camera.setZoom(Math.min(w * .65 / 1930, (h - 160) / 1200));
      camera.centerOn(0, 470);
    } else if (menu) {
      camera.setViewport(0, h * .38, w, h * .57);
      camera.setZoom(Math.min(w / 1900, h * .57 / 1160));
      camera.centerOn(0, 470);
    } else {
      camera.setViewport(0, 0, w, h);
      camera.setZoom(Math.min(w < 600 ? .78 : 1, Math.max(.58, w / 1000)));
      const p = iso(this.sim.player.x, this.sim.player.y);
      this.follow.x = p.x;
      this.follow.y = p.y;
      this.placeCamera(1);
    }
  }

  placeCamera(amount) {
    const p = iso(this.sim.player.x, this.sim.player.y);
    this.follow.x += (p.x - this.follow.x) * amount;
    this.follow.y += (p.y - this.follow.y) * amount;
    const cam = this.cameras.main;
    const halfW = cam.width / cam.zoom / 2;
    const halfH = cam.height / cam.zoom / 2;
    // The projected island has a fixed rectangular camera envelope.
    const x = halfW > 1020 ? 0 : Phaser.Math.Clamp(this.follow.x, -1020 + halfW, 1020 - halfW);
    const y = halfH > 640 ? 480 : Phaser.Math.Clamp(this.follow.y - 35, -130 + halfH, 1150 - halfH);
    cam.centerOn(x, y);
  }

  resetViews() {
    this.accumulator = 0;
    const district=this.sim.mission?.district||'town';
    if(this.currentDistrict!==district){
      this.ground.destroy();
      this.decor.forEach(d=>d.view.destroy());
      this.ground=drawGround(this,district);
      this.decor=createDecor(this,district);
      this.currentDistrict=district;
    }
    this.buildings.forEach((v, i) => {
      const b = this.sim.buildings[i];
      v.hp = b.maxHp; v.dead = false; v.shake = 0; v.collapseTime = 0; v.collapse.setVisible(false).setRotation(0);
      const loc=iso(b.x,b.y);
      v.view.setTexture(`${b.type}-0`).setAlpha(1).setScale(1).setDepth(b.x+b.y).setPosition(loc.x,loc.y+ART_ANCHOR.building);
      v.collapse.setTexture(`${b.type}-2`).setDepth(b.x+b.y+2);
      v.health.setDepth(b.x+b.y+.5);
      v.health.clear();
    });
    this.particles.forEach(p => { p.life = 0; p.view.setVisible(false); });
    this.labels.forEach(p => { p.life = 0; p.view.setVisible(false); });
    this.attackArea.setVisible(false);
    this.layout();
  }

  emit(type, x, y, count, colors = null) {
    if (!this.controls.effects) count = Math.min(count, 3);
    if (this.controls.quality === 'low') count = Math.max(1, Math.ceil(count * .45));
    for (let i = 0; i < count; i++) {
      const p = this.particles[this.effectIndex++ % this.particles.length];
      const angle = Math.random() * Math.PI * 2;
      const force = type === 'coin' ? 45 : 40 + Math.random() * 90;
      p.x = x; p.y = y; p.z = 14 + Math.random() * 30;
      p.vx = Math.cos(angle) * force; p.vy = Math.sin(angle) * force;
      p.vz = 45 + Math.random() * 120; p.life = p.max = .6 + Math.random() * .6;
      p.size = type === 'dust' ? .7 + Math.random() * .7 : .6 + Math.random() * .55;
      p.view.setTexture(type).setTint(colors ? colors[i % colors.length] : 0xffffff)
        .setScale(p.size).setAlpha(1).setVisible(true).setAngle(Math.random() * 360);
    }
  }

  floatLabel(x, y, text, color = '#fff0b0', height = 90) {
    const label = this.labels[this.labelIndex++ % this.labels.length];
    const p = iso(x, y, height);
    label.life = 1.2; label.y = p.y;
    label.view.setPosition(p.x, p.y).setText(text).setColor(color).setAlpha(1).setVisible(true);
  }

  handleEvents(events) {
    for (const e of events) {
      const index = this.sim.buildings.findIndex(b => b.id === e.buildingId);
      const v = this.buildings[index];
      if(e.type==='sector'){this.resetViews();}
      if (e.type === 'ram') {
        this.emit('spark', this.sim.player.x, this.sim.player.y, 8);
      } else if (e.type === 'ability-impact') {
        this.emit('spark',e.targetX,e.targetY,7);this.emit('dust',e.targetX,e.targetY,9);
        if(this.controls.effects && this.controls.shake !== false)this.cameras.main.shake(100,.0015);
      } else if(e.type==='chain'){
        if(e.count>1)this.floatLabel(e.x,e.y,t('chainLabel',{count:e.count}),'#fff1c7',150);
      } else if (e.type === 'hit') {
        if (v) v.shake = .24;
        this.emit('chip', e.x, e.y, 6, FRAGMENT_COLORS[this.sim.buildings[index]?.type]);
        this.emit('dust', e.x, e.y, 4);
      } else if (e.type === 'destroy') {
        if(v){v.collapseDuration=this.sim.buildings[index]?.type==='tower'?.65:.32;v.collapseTime=v.collapseDuration;v.collapse.setVisible(true).setScale(1).setRotation(0).setAlpha(1);}
        const type = this.sim.buildings[index]?.type;
        this.emit('chip', e.x, e.y, 16, FRAGMENT_COLORS[type]);
        this.emit('dust', e.x, e.y, 12);
        this.floatLabel(e.x, e.y, t('pointsReward',{points:e.points ?? 0}), '#fff1b7', 112);
        if (e.coins > 0) {
          this.emit('coin', e.x, e.y, 6);
          this.floatLabel(e.x, e.y, t('coinsReward',{coins:e.coins}), '#ffe38b', 82);
        }
        if (type === 'house' || type === 'warehouse' || type === 'tower') {
          this.floatLabel(e.x, e.y, t('superHit'), '#fff8d5', 190);
          if (this.controls.effects && this.controls.shake !== false) this.cameras.main.shake(120, .002);
        }
      }
    }
    this.controls.onEvents?.(events);
  }

  update(_, delta) {
    if (!this.dozer) return;
    const dt = Math.min(delta / 1000, .1);
    this.elapsed += dt;
    const active = this.controls.screen === 'playing' && !this.controls.paused;
    if (active) {
      this.accumulator += dt;
      while (this.accumulator >= 1 / 60) {
        Object.assign(this.frameInput, this.controls.input);
        this.frameInput.ramPressed = Boolean(this.controls.ramQueued);
        this.controls.ramQueued = false;
        this.sim.update(1 / 60, this.frameInput);
        const events = this.sim.events.slice();
        this.accumulator -= 1 / 60;
        if (events.length) this.handleEvents(events);
        if (this.sim.phase === 'won' || this.sim.phase === 'lost') {
          this.controls.onFinish?.();
          this.accumulator = 0;
          break;
        }
      }
    } else this.accumulator = 0;

    const menu = this.controls.screen === 'menu';
    const player = this.sim.player;
    const x = menu ? 710 : player.x, y = menu ? 900 : player.y;
    const angle = menu ? -.5 : player.heading;
    const p = iso(x, y);
    const moving = active && player.speed > 8;
    const vibration = moving ? Math.sin(this.elapsed * 22) * .28 : Math.sin(this.elapsed * 2) * .15;
    const tread=moving?Math.floor(this.elapsed*18)%4*2:0;
    const vehicleId=this.sim.vehicleId||'dozer';
    const fraction=!menu&&vehicleId!=='dozer'&&player.ramTime>0?player.abilityElapsed/player.abilityDuration:null;
    const reach=player.attackTarget?Math.hypot(player.attackTarget.x-player.x,player.attackTarget.y-player.y):115;
    const texture=vehiclePose(this,vehicleId,angle,tread,fraction,reach);
    this.dozer.setTexture(texture).setPosition(p.x,p.y+getVehicleTextureOffset(vehicleId)+vibration).setDepth(x+y+1);
    const target=player.attackTarget;
    if(active&&target&&vehicleId!=='dozer'){
      const q=iso(target.x,target.y);this.attackArea.setVisible(true).setPosition(q.x,q.y).setDisplaySize(2.449*target.radius,1.414*target.radius).setDepth(target.x+target.y-180);
    }else this.attackArea.setVisible(false);
    const squash = active && player.ramTime > 0 ? 1+Math.sin(player.abilityElapsed/player.abilityDuration*Math.PI)*.015 : 1;
    this.dozer.setScale(squash);
    this.shadow.setPosition(p.x, p.y + 5).setDepth(x + y - 1);
    const dustRate = this.controls.quality === 'low' ? 7 : 15;
    if (moving && this.controls.effects && Math.floor(this.elapsed * dustRate) !== this.lastDust) {
      this.lastDust = Math.floor(this.elapsed * dustRate);
      this.emit('dust', x - Math.cos(angle) * 30, y - Math.sin(angle) * 30, 1);
    }

    this.buildings.forEach((v, i) => {
      const b = this.sim.buildings[i], loc = iso(b.x, b.y);
      if (v.hp !== b.hp) {
        v.hp = b.hp;
        if (b.hp <= 0) {
          v.view.setTexture('rubble').setDepth(b.x + b.y - 120);
          v.dead = true;
          v.health.clear();
        } else {
          const stage = Math.min(2, Math.max(1, Math.ceil((1 - b.hp / b.maxHp) * 2)));
          v.view.setTexture(`${b.type}-${stage}`);
          const height = b.type === 'tower' ? 185 : b.type === 'house' ? 154 : b.type === 'warehouse'?120 : b.type === 'containers'?110 : b.type === 'kiosk' ? 101 : 78;
          v.health.clear().fillStyle(0x25443c, .65).fillRoundedRect(loc.x - 26, loc.y - height, 52, 5, 2);
          v.health.fillStyle(0xf0b64c).fillRoundedRect(loc.x - 26, loc.y - height, Math.max(2, 52 * b.hp / b.maxHp), 5, 2);
        }
      }
      if(v.collapseTime>0&&!this.controls.paused){v.collapseTime=Math.max(0,v.collapseTime-dt);const t=1-v.collapseTime/(v.collapseDuration||.32),tower=b.type==='tower';v.collapse.setPosition(loc.x+(tower?t*100:0),loc.y+ART_ANCHOR.building+t*(tower?32:12)).setScale(1+(tower?0:t*.12),1-t*(tower?.12:.75)).setRotation(tower?t*1.2:0).setAlpha(tower?Math.min(1,(1-t)*2):1-t).setVisible(v.collapseTime>0);}
      v.shake = Math.max(0, v.shake - dt);
      v.view.setPosition(loc.x + Math.sin(v.shake * 70) * v.shake * 18, loc.y + ART_ANCHOR.building);
      if (v.shake > 0) v.view.setTint(0xffe6ac); else v.view.clearTint();
    });

    if (!this.controls.paused) {
      for (const part of this.particles) {
        if (part.life <= 0) continue;
        part.life -= dt;
        if (part.life <= 0) { part.view.setVisible(false); continue; }
        part.x += part.vx * dt; part.y += part.vy * dt;
        part.vz -= 280 * dt; part.z += part.vz * dt;
        if (part.z < 2) { part.z = 2; part.vz = Math.abs(part.vz) * .28; part.vx *= .7; part.vy *= .7; }
        const q = iso(part.x, part.y, part.z);
        part.view.setPosition(q.x, q.y).setDepth(part.x + part.y + 160).setAlpha(Math.min(1, part.life * 3));
        if (part.view.texture.key === 'dust') part.view.setScale(part.size * (2 - part.life / part.max));
        else part.view.angle += dt * 90;
      }
      for (const label of this.labels) {
        if (label.life <= 0) continue;
        label.life -= dt;
        label.y -= dt * 34;
        label.view.setY(label.y).setAlpha(Math.min(1, label.life * 3)).setVisible(label.life > 0);
      }
    }
    if (!menu) this.placeCamera(1 - Math.exp(-dt * 6));
    this.controls.onFrame?.(this.sim, moving);
  }
}
