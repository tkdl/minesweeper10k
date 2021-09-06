#version 300 es

in vec4 position;
out vec2 uv;

void main() {
    uv = position.xy * 0.5 + 0.5;
    vec2 pos2d = position.xy;
    gl_Position = vec4(pos2d, 0.0, 1.0);
}
