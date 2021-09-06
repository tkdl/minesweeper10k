#version 300 es
precision highp float;

in vec2 uv;
out vec4 fragColor;

uniform sampler2D u_field;
uniform sampler2D u_tileset;
uniform float u_chunkSize;

float idiv(float a, float b) {
    return floor(a / b);
}

float imod(float a, float b) {
    return floor(a - idiv(a, b) * b);
}

void main() {
    vec2 fieldCoords = uv * u_chunkSize;
    vec2 tileCoords = fract(fieldCoords);

    tileCoords = vec2(tileCoords.x, 1.0 - tileCoords.y);

    float packedState = texture(u_field, uv).r * 256.0;
    
    float tileNumber = imod(packedState, 16.0);
    float tilesetRow = idiv(tileNumber, 4.0);
    float tilesetCol = imod(tileNumber, 4.0);
    vec2 tilesetOffset = vec2(tilesetCol, tilesetRow) * 0.25;

    vec3 tile = texture(u_tileset, tileCoords * 0.25 + tilesetOffset - vec2(0, 0.0125)).rgb; 

    vec3 color = tile;
    fragColor = vec4(color, 1.0);
}
