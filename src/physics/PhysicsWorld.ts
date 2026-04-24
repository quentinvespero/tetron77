import RAPIER from '@dimforge/rapier3d-compat'

// Fixed physics timestep (60 Hz)
const PHYSICS_STEP = 1 / 60
// Max steps per frame to prevent spiral-of-death on slow frames
const MAX_STEPS = 3

export class PhysicsWorld {
    readonly world: RAPIER.World
    private accumulator = 0

    constructor() {
        // Gravity pointing down
        this.world = new RAPIER.World({ x: 0, y: -20, z: 0 })
    }

    /**
     * Advances the physics simulation using a fixed-timestep accumulator.
     * Call this once per game loop frame with the real frame delta.
     */
    private step(dt: number): void {
        this.accumulator += dt

        let steps = 0
        while (this.accumulator >= PHYSICS_STEP && steps < MAX_STEPS) {
            this.world.step()
            this.accumulator -= PHYSICS_STEP
            steps++
        }

        // If we hit the step cap, discard remaining accumulated time
        // to avoid runaway catching-up on the next frame
        if (steps >= MAX_STEPS) {
            this.accumulator = 0
        }
    }

    createRigidBody(desc: RAPIER.RigidBodyDesc): RAPIER.RigidBody {
        return this.world.createRigidBody(desc)
    }

    createCollider(desc: RAPIER.ColliderDesc, parent: RAPIER.RigidBody): RAPIER.Collider {
        return this.world.createCollider(desc, parent)
    }

    removeRigidBody(body: RAPIER.RigidBody): void {
        this.world.removeRigidBody(body)
    }

    update(dt: number): void {
        this.step(dt)
    }
}
