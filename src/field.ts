import * as _ from 'lodash';
import Denque from "denque";
import { hash, idiv } from "./utils";

const Tiles = {
  // 0 to 8 - tiles with numbers
  DEFAULT: 9,
  FLAG: 10,
  BOMB: 11,
  EXPLODED: 12
}

interface UnpackedState {
  tileNumber: number;
  hasBomb: boolean;
  opened:  boolean;
  flagged: boolean;
}

class State {
  static TILE_NUMBER = 0xF;
  static BOMB = 1 << 4;
  static OPEN = 1 << 5;
  static FLAG = 1 << 6;

  static pack(state: UnpackedState) : number {
    let result = 0x0;
    result |= state.tileNumber & State.TILE_NUMBER;
    if (state.hasBomb) result |= State.BOMB;
    if (state.opened)  result |= State.OPEN;
    if (state.flagged) result |= State.FLAG;
    return result;
  }

  static unpack(packed: number) : UnpackedState {
    return {
      tileNumber: packed & State.TILE_NUMBER,
      hasBomb: (packed & State.BOMB) > 0,
      opened:  (packed & State.OPEN) > 0,
      flagged: (packed & State.FLAG) > 0
    }
  }

  static getProperty(packed: number, mask: number) { return (packed & mask) !== 0; }
}

export class Field {
  width: number;
  height: number;
  cellsCount: number;
  
  bombsCount: number;
  openCount: number;
  flaggedCount: number;
  
  firstClick: boolean;
  bombMoveToIdx: number;

  data: Uint8Array;

  constructor(width: number, height: number, bombsCount: number) {
    this.width = width;
    this.height = height;
    this.cellsCount = width * height;
    this.bombsCount = bombsCount;
    this.openCount = 0;
    this.flaggedCount = 0;
    this.firstClick = true;

    this.data = new Uint8Array(this.cellsCount);
    this.fillBombs();
  } 

  fillBombs() {
    let defaultState = State.pack({
        tileNumber: Tiles.DEFAULT,
        hasBomb: false,
        opened: false,
        flagged: false
    });
    this.data.forEach((v, i) => { this.data[i] = defaultState; });
    
    const bombIndexes = _.sampleSize(_.range(0, this.cellsCount), this.bombsCount + 1);
    this.bombMoveToIdx = bombIndexes.pop();
    bombIndexes.forEach(i => { this.data[i] |= State.BOMB; });
  };

  get(row: number, col: number) { return this.data[this.flatten(row, col)]; }
  set(row: number, col: number, value: number) { this.data[this.flatten(row, col)] = value; }

  getRow(i: number) { return this.data.subarray(this.width * i, this.width * (i + 1)); }

  getChunk(rowOffset: number, colOffset: number, size: number, dst: Uint8Array) {
    for (var i = 0; i < size; i++) {
      let row = this.getRow(i + rowOffset).subarray(colOffset, colOffset + size);
      dst.set(row, i * size);
    }
  }
  
  opened(idx: number)  { return State.getProperty(this.data[idx], State.OPEN); } 
  hasBomb(idx: number) { return State.getProperty(this.data[idx], State.BOMB); } 
  flagged(idx: number) { return State.getProperty(this.data[idx], State.FLAG); } 
  
  onClick(row: number, col: number, button: number) {
    let index = this.flatten(row, col);
    
    switch (button) {
      case 0: 
        this.openCell(index);
        break;
      case 2:
        this.toggleFlag(index);
        break;
    }
  }
  
  flatten(row: number, col: number) {
    return row * this.width + col;
  }
  
  unflatten(idx: number) {
    return {row: idiv(idx, this.width), col: idx % this.width}; 
  }

  openCell(index: number) {
    if (this.opened(index)) return;
    this.data[index] |= State.OPEN;
        
    if (this.hasBomb(index)) {
      if (!this.firstClick) {
        this.onBombClick(index);
        return;
      } else {
        this.moveBomb(index);
      }
    }
    
    this.firstClick = false;

    let neighborQueue = new Denque();
    neighborQueue.push(index);

    while (!neighborQueue.isEmpty()) {
      let current = neighborQueue.shift();
      let neighbors = this.getNeighborsIndexes(current);
      let neighborBombCount = neighbors.filter(i => this.hasBomb(i)).length;
      
      this.data[current] &= ~0xF;
      this.data[current] |= neighborBombCount;

      this.openCount++;

      if (neighborBombCount === 0) {
        neighbors.filter(i => !this.opened(i)).forEach(i => {
          this.data[i] |= State.OPEN;
          neighborQueue.push(i);
        });
      }
    }
  }

  toggleFlag(index: number) {
    if (this.opened(index)) return;
    
    const set = () => {
      this.data[index] ^= State.FLAG;    
      this.data[index] &= ~0xF;
      this.data[index] |= Tiles.FLAG;
      this.flaggedCount++;
    };
    
    const unset = () => {
      this.data[index] ^= State.FLAG;    
      this.data[index] &= ~0xF;
      this.data[index] |= Tiles.DEFAULT;
      this.flaggedCount--;
    };
    
    if (this.flagged(index))
      unset();
    else if (!this.flagged(index) && this.flaggedCount < this.bombsCount)
      set();
  }

  moveBomb(from: number) {
    this.data[from] &= ~State.BOMB;
    this.data[this.bombMoveToIdx] |= State.BOMB;
  }

  onBombClick(index: number) {
    let revealBombs = async (startRow, endRow) => {
      for (let i = startRow; i < endRow; i++) {
        let row = this.getRow(i);
        for(let j = 0; j < this.width; j++) {
          row[j] |= State.OPEN;
        
          let flatIndex = this.flatten(i, j);
          if (this.hasBomb(flatIndex) && !this.flagged(flatIndex) && flatIndex != index) {
            row[j] &= ~0xF;
            row[j] |= Tiles.BOMB;
          }
        }
      }
    }

    let currentRow = this.unflatten(index).row;
    let start = Math.max(currentRow - 64, 0);
    let end   = Math.min(currentRow + 64, this.height);

    setTimeout(() => revealBombs(start, end), 1);
    setTimeout(() => revealBombs(0, start), 10);
    setTimeout(() => revealBombs(end, this.height), 20);

    this.data[index] &= ~0xF;
    this.data[index] |= Tiles.EXPLODED;
  }

  getNeighborsIndexes(center: number) {
      let idx2d = this.unflatten(center);
      return [
        {row: idx2d.row - 1, col: idx2d.col - 1},
        {row: idx2d.row - 1, col: idx2d.col    },
        {row: idx2d.row - 1, col: idx2d.col + 1},
        {row: idx2d.row,     col: idx2d.col - 1},
        {row: idx2d.row,     col: idx2d.col + 1},
        {row: idx2d.row + 1, col: idx2d.col - 1},
        {row: idx2d.row + 1, col: idx2d.col    },
        {row: idx2d.row + 1, col: idx2d.col + 1}
      ]
      .filter(x => x.row >= 0 && x.row < this.height && x.col >= 0 && x.col < this.width)
      .map(x => this.flatten(x.row, x.col));
  }

  print() { 
    for (var i = 0; i < this.width; i++) {
      console.log(this.getRow(i).toString());
    }
  }
}
