import * as twgl from 'twgl.js';
import { GUI } from 'dat.gui';
import Stats from 'stats.js';
import { Field } from './field';
import { idiv, clamp } from './utils';

const basicVertShader = require('./shaders/basic.vert');
const basicFragShader = require('./shaders/basic.frag');

const canvas = document.getElementById('webgl-canvas');
const gl: WebGLRenderingContext = (canvas as any).getContext('webgl2');
const programInfo = twgl.createProgramInfo(gl, [basicVertShader, basicFragShader]);

const arrays = {
  position: [
    -1, -1, 0,
    1, -1, 0,
    -1, 1, 0,
    -1, 1, 0,
    1, -1, 0,
    1, 1, 0
  ]
};

const bufferInfo = twgl.createBufferInfoFromArrays(gl, arrays);

const chunkSize = 32;
const chunkTextureData = new Uint8Array(chunkSize * chunkSize);
let viewportSize = 32 * 8;
let chunkTexture: WebGLTexture;
const tileset = twgl.createTexture(gl, {
  target: gl.TEXTURE_2D,
  src:    'tileset.png',
  min:    gl.LINEAR,
  mag:    gl.LINEAR,
  wrap:   gl.CLAMP_TO_EDGE
});

let fieldOffset: {x: number, y: number};

let field: Field;

let fieldParams = {
  Width: 3200,
  Height: 3200,
  Bombs: 0.15,

  Init: function () {
    fieldOffset = {x: 0, y: 0}
    field = new Field(this.Width, this.Height, Math.floor(this.Width * this.Height * this.Bombs)); 
  }
}

fieldParams.Init();

//#region Input

class Pointer {
  position     = {x: 0, y: 0};
  prevPosition = {x: 0, y: 0};
  
  down = false;
  button: number;
  
  updatePosition = (e: PointerEvent) => {
    this.prevPosition.x = this.position.x;
    this.prevPosition.y = this.position.y;

    this.position.x = e.clientX;
    this.position.y = viewportSize - e.clientY;
  };

  onMove = (e: PointerEvent) => {
    if (this.down && (this.button === 1 || e.altKey)) {
      this.updatePosition(e);
      
      fieldOffset.x += this.position.x - this.prevPosition.x;
      fieldOffset.y += this.position.y - this.prevPosition.y;
      
      fieldOffset.x = clamp(fieldOffset.x, -viewportSize * (field.width  / chunkSize - 1), 0);
      fieldOffset.y = clamp(fieldOffset.y, -viewportSize * (field.height / chunkSize - 1), 0);
    }
  };

  onDown = (e: PointerEvent) => {
    this.down = true;
    this.button = e.button;
    this.updatePosition(e);
  };

  onUp = (e: PointerEvent) => {
    this.down = false
  };

  onLeave = (e: PointerEvent) => {
    this.down = false;
  }

  onClick = (e: PointerEvent) => {
    if (e.button === 2) e.preventDefault();

    if ((e.button === 0 || e.button === 2) && !e.altKey) {
      let x = this.position.x - fieldOffset.x;
      let y = this.position.y - fieldOffset.y;
      
      let cellsize = viewportSize / chunkSize;
      let row = idiv(y, cellsize);
      let col = idiv(x, cellsize);
      
      console.log(x, y, cellsize, row, col);
      field.onClick(row, col, e.button);
    }
  }
}

let pointer = new Pointer();

canvas.addEventListener('mousemove',   pointer.onMove );
canvas.addEventListener('mousedown',   pointer.onDown );
canvas.addEventListener('mouseup',     pointer.onUp   );
canvas.addEventListener('mouseleave',  pointer.onLeave);
canvas.addEventListener('click',       pointer.onClick);
canvas.addEventListener('contextmenu', pointer.onClick);


let stats = new Stats();
stats.showPanel(0);
stats.dom.style.cssText = 'position:absolute;top:140px;left:100vh;margin-left:5px;';
document.body.appendChild(stats.dom);


let gui = new GUI();
// gui.domElement.id = "gui";
gui.add(fieldParams, 'Width', 32, 10000, 32);
gui.add(fieldParams, 'Height', 32, 10000, 32);
gui.add(fieldParams, 'Bombs', 0, 0.95, 0.05);
gui.add(fieldParams, 'Init');
//#endregion


//#region Render
function generateChunkTexture(rowOffset: number, colOffset: number) {
  field.getChunk(rowOffset, colOffset, chunkSize, chunkTextureData);

  // TODO Possible optimisation: properly update texture instead of deleting and creating new one (still fast enough now)
  gl.deleteTexture(chunkTexture);
  chunkTexture = twgl.createTexture(gl, {
    target: gl.TEXTURE_2D,
    format: gl.LUMINANCE,
    type:   gl.UNSIGNED_BYTE,
    width:  chunkSize,
    height: chunkSize,
    src:    chunkTextureData,
    min:    gl.NEAREST,
    mag:    gl.NEAREST,
    wrap:   gl.CLAMP_TO_EDGE,
  });
}

function drawChunk(xOffset: number, yOffset: number) {
  let chunkIndex = [
    idiv(-fieldOffset.y, viewportSize) + yOffset,
    idiv(-fieldOffset.x, viewportSize) + xOffset,
  ]
  
  generateChunkTexture(
    chunkIndex[0] * chunkSize,
    chunkIndex[1] * chunkSize
  );  
  
  gl.viewport(
    fieldOffset.x % viewportSize + xOffset * viewportSize,
    fieldOffset.y % viewportSize + yOffset * viewportSize,
    viewportSize,
    viewportSize
  );

  const uniforms = {
    u_field: chunkTexture,
    u_tileset: tileset,
    u_chunkSize: chunkSize
  };

  gl.useProgram(programInfo.program);
  twgl.setBuffersAndAttributes(gl, programInfo, bufferInfo);
  twgl.setUniforms(programInfo, uniforms);
  twgl.drawBufferInfo(gl, bufferInfo);
}



function render(time: number) {
  stats.begin();

  twgl.resizeCanvasToDisplaySize(gl.canvas as HTMLCanvasElement);
  
  viewportSize = Math.min(gl.canvas.width, gl.canvas.height);

  drawChunk(0, 0);
  drawChunk(1, 1);
  drawChunk(0, 1);
  drawChunk(1, 0);

  stats.end();

  requestAnimationFrame(render);
}

requestAnimationFrame(render);
//#endregion