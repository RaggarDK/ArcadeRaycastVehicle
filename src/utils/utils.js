import { Vector3, Quaternion } from '@babylonjs/core/maths/math.vector.js'

const getBodyVelocityAtPoint = (body, point) => {
    const r = point.subtract(body.transformNode.position)
    const angularVelocity = body.getAngularVelocity()
    Vector3.Cross(angularVelocity, r)
    const res = Vector3.Cross(angularVelocity, r)
    const velocity = body.getLinearVelocity()
    res.addInPlace(velocity)
    return res;
}

const clampNumber = (num, a, b) => Math.max(Math.min(num, Math.max(a, b)), Math.min(a, b));
const lerp = (x, y, a) => x * (1 - a) + y * a;
export { getBodyVelocityAtPoint, clampNumber, lerp }