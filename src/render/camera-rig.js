// RTS camera (spec §5.5): orbits a ground target at ~55° pitch; yaw 0 looks north (map up = screen up).
import * as THREE from 'three';

const deg = THREE.MathUtils.degToRad;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export class CameraRig {
  constructor(camera, mapW, mapH) {
    this.camera = camera;
    this.mapW = mapW;
    this.mapH = mapH;
    this.target = new THREE.Vector3(mapW / 2, 0, mapH / 2);
    this.goal = this.target.clone();
    this.minDistance = 8; this.maxDistance = 64;
    this.minPitch = deg(32); this.maxPitch = deg(80);
    this.distance = this.goalDistance = 16;
    this.pitch = this.goalPitch = deg(55);
    this.yaw = this.goalYaw = 0;
    this.shake = 0;
    this.offset = new THREE.Vector3();
  }

  get forward() { return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw)); }
  get right() { return new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)); }

  lookAt(x, z, immediate = false) {
    this.goal.set(clamp(x, 0, this.mapW), 0, clamp(z, 0, this.mapH));
    if (immediate) { this.target.x = this.goal.x; this.target.z = this.goal.z; }
  }

  pan(dRight, dForward) {
    const f = this.forward, r = this.right;
    this.lookAt(this.goal.x + r.x * dRight + f.x * dForward, this.goal.z + r.z * dRight + f.z * dForward);
  }

  zoom(factor) { this.goalDistance = clamp(this.goalDistance * factor, this.minDistance, this.maxDistance); }
  rotate(dYaw, dPitch) { this.goalYaw += dYaw; this.goalPitch = clamp(this.goalPitch + dPitch, this.minPitch, this.maxPitch); }
  reset() { this.goalYaw = 0; this.goalPitch = deg(55); this.goalDistance = 16; }

  update(dt, heightAt) {
    const k = 1 - Math.exp(-dt * 12);
    this.target.x += (this.goal.x - this.target.x) * k;
    this.target.z += (this.goal.z - this.target.z) * k;
    const ground = heightAt ? heightAt(this.target.x, this.target.z) : 0;
    this.target.y += (ground - this.target.y) * k;
    this.distance += (this.goalDistance - this.distance) * k;
    this.yaw += (this.goalYaw - this.yaw) * k;
    this.pitch += (this.goalPitch - this.pitch) * k;
    const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
    this.offset.set(Math.sin(this.yaw) * cp, sp, Math.cos(this.yaw) * cp).multiplyScalar(this.distance);
    this.camera.position.copy(this.target).add(this.offset);
    if (this.shake > 0) {
      const s = this.shake * 0.35;
      this.camera.position.x += (Math.random() - 0.5) * s;
      this.camera.position.y += (Math.random() - 0.5) * s;
      this.shake = Math.max(0, this.shake - dt * 2.5);
    }
    this.camera.lookAt(this.target);
    this.camera.updateMatrixWorld();
  }
}
