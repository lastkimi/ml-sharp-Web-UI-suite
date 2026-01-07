/**
 * EWA Splatting Shaders for 3D Gaussian Splatting
 */

export const vertexShader = `#version 300 es
precision highp float;

// Quad vertex position (-0.5 to 0.5)
in vec2 position;

// Per-instance attributes
in vec3 instancePosition;
in vec4 instanceRotation;  // Quaternion [w, x, y, z]
in vec3 instanceScale;
in vec4 instanceColor;     // RGB + Opacity

// Uniforms
uniform mat4 u_projection;
uniform mat4 u_view;
uniform vec2 u_focal;      // Focal length in pixels [fx, fy]
uniform vec2 u_viewport;   // Viewport size [width, height]

// Outputs
out vec4 vColor;
out vec2 vPixelOffset;     // Offset from center in pixels
out vec3 vConic;           // Inverse covariance [d, -b, a] / det

// Helper: Quaternion to rotation matrix (3x3)
mat3 quaternionToMatrix(vec4 q) {
    float w = q.x, x = q.y, y = q.z, z = q.w;
    return mat3(
        1.0 - 2.0*(y*y + z*z), 2.0*(x*y - z*w), 2.0*(x*z + y*w),
        2.0*(x*y + z*w), 1.0 - 2.0*(x*x + z*z), 2.0*(y*z - x*w),
        2.0*(x*z - y*w), 2.0*(y*z + x*w), 1.0 - 2.0*(x*x + y*y)
    );
}

void main() {
    vec3 center = instancePosition;
    vec4 quat = instanceRotation;
    vec3 scale = instanceScale;
    vec4 color = instanceColor;

    // 1. Compute 3D Covariance Matrix
    mat3 R = quaternionToMatrix(quat);
    mat3 S = mat3(scale.x, 0.0, 0.0, 0.0, scale.y, 0.0, 0.0, 0.0, scale.z);
    mat3 M = R * S;
    mat3 Sigma3D = M * transpose(M);

    // 2. Transform to View Space
    mat3 W = mat3(u_view);
    mat3 T = W * Sigma3D * transpose(W);

    // 3. Project to 2D Screen Space (Jacobian)
    vec4 viewPos4 = u_view * vec4(center, 1.0);
    vec3 viewPos = viewPos4.xyz;

    // Clip near plane (avoid division by zero)
    if (viewPos.z > -0.01) {
        gl_Position = vec4(0.0, 0.0, 2.0, 1.0);
        return;
    }

    float fx = u_focal.x;
    float fy = u_focal.y;
    float tz = viewPos.z;
    float tx = viewPos.x;
    float ty = viewPos.y;
    float z_inv = 1.0 / tz;
    float z_inv2 = z_inv * z_inv;

    mat3 J = mat3(
        fx * z_inv, 0.0, -fx * tx * z_inv2,
        0.0, fy * z_inv, -fy * ty * z_inv2,
        0.0, 0.0, 0.0
    );

    mat3 Cov2D = J * T * transpose(J);

    // 4. Compute Eigenvalues for Bounding Box
    float a = Cov2D[0][0] + 0.3;  // Dilation to prevent aliasing
    float b = Cov2D[0][1];
    float d = Cov2D[1][1] + 0.3;

    float det = a * d - b * b;
    float trace = a + d;
    float discriminant = max(0.0, trace * trace - 4.0 * det);
    float sqrt_disc = sqrt(discriminant);
    float lambda1 = 0.5 * (trace + sqrt_disc);
    float lambda2 = 0.5 * (trace - sqrt_disc);

    // 5. Compute Quad Extent (3 sigma covers 99% of Gaussian)
    float max_radius = 3.0 * sqrt(max(lambda1, lambda2));
    
    // Quad vertex offset in pixels
    vec2 quadUV = position * 2.0;  // -1 to 1
    vec2 pixelOffset = quadUV * max_radius;

    // 6. Compute Inverse Covariance (Conic) for Fragment Shader
    float det_inv = 1.0 / max(det, 0.0001);  // Avoid division by zero
    vConic = vec3(d * det_inv, -b * det_inv, a * det_inv);
    vPixelOffset = pixelOffset;
    vColor = color;

    // 7. Final Position
    gl_Position = u_projection * viewPos4;
    
    // Add offset in NDC space
    vec2 pixelToNDC = vec2(2.0 / u_viewport.x, 2.0 / u_viewport.y);
    gl_Position.xy += pixelOffset * pixelToNDC * gl_Position.w;
}
`;

export const fragmentShader = `#version 300 es
precision highp float;

in vec4 vColor;
in vec2 vPixelOffset;  // Offset from center in pixels
in vec3 vConic;        // Inverse covariance [d, -b, a] / det

out vec4 fragColor;

void main() {
    // Evaluate Gaussian: exp(-0.5 * x^T * Cov^-1 * x)
    vec2 d = vPixelOffset;
    
    // Power = -0.5 * (d.x * (conic.x * d.x + conic.y * d.y) + d.y * (conic.y * d.x + conic.z * d.y))
    float power = -0.5 * (vConic.x * d.x * d.x + 2.0 * vConic.y * d.x * d.y + vConic.z * d.y * d.y);

    // Early discard for pixels far from center
    if (power > 0.0) discard;  // Should be negative

    float alpha = exp(power) * vColor.a;
    
    // Discard low alpha pixels
    if (alpha < 0.01) discard;

    fragColor = vec4(vColor.rgb, alpha);
}
`;
