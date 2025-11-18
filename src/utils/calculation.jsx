export function angle3D(A, B, C) {
    if (!A || !B || !C) return null;

    // Use normalized coords directly (don't convert to pixel for vector math)
    const BAx = A.x - B.x;
    const BAy = A.y - B.y;
    const BAz = (A.z ?? 0) - (B.z ?? 0);

    const BCx = C.x - B.x;
    const BCy = C.y - B.y;
    const BCz = (C.z ?? 0) - (B.z ?? 0);

    const magBA = Math.hypot(BAx, BAy, BAz);
    const magBC = Math.hypot(BCx, BCy, BCz);

    // Avoid zero-length vectors
    if (magBA === 0 || magBC === 0) return null;

    const dot = BAx * BCx + BAy * BCy + BAz * BCz;
    let cos = dot / (magBA * magBC);

    // Clamp to [-1, 1] to avoid NaN from floating point errors
    cos = Math.min(1, Math.max(-1, cos));

    const angleRad = Math.acos(cos);
    return angleRad * (180 / Math.PI); // degrees
    // if (!A || !B || !C) return null;

    // const BA = {
    //     x: A.x - B.x,
    //     y: A.y - B.y,
    //     z: A.z - B.z,
    // };

    // const BC = {
    //     x: C.x - B.x,
    //     y: C.y - B.y,
    //     z: C.z - B.z,
    // };

    // // dot product
    // const dot = BA.x * BC.x + BA.y * BC.y + BA.z * BC.z;

    // // magnitudes
    // const magBA = Math.sqrt(BA.x**2 + BA.y**2 + BA.z**2);
    // const magBC = Math.sqrt(BC.x**2 + BC.y**2 + BC.z**2);

    // if (magBA === 0 || magBC === 0) return null;

    // // Clamp value to avoid floating errors (very important)
    // const cosAngle = Math.min(Math.max(dot / (magBA * magBC), -1), 1);

    // // Convert rad → deg
    // return Math.acos(cosAngle) * (180 / Math.PI);
}
