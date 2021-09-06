import { suite, test } from '@testdeck/mocha';
import * as chai from 'chai';
import { Field} from '../src/field';

let should = chai.should();

@suite class FieldTests {

  field: Field;
  bombsCount: number;
  freeCell: number;
  bombCell: number;

  before() {
    this.field = new Field(3, 3, 8);
    this.bombsCount = this.field.data.filter((v, i) => {return this.field.hasBomb(i)}).length;
    this.freeCell = this.field.data.findIndex((v, i) => {return !this.field.hasBomb(i)});
    this.bombCell = this.field.data.findIndex((v, i) => {return this.field.hasBomb(i)});
  }

  @test 'should create 3x3 field'() : any {
    should.equal(this.field.data.length, 9);
  }

  @test 'should be 8 bombs'() {
    should.equal(this.bombsCount, 8);
  }

  @test 'should be free cell'() {
    should.not.equal(this.freeCell, -1);
  }

  @test 'should move bomb on first click'() {
    let idx2d = this.field.unflatten(this.bombCell);
    this.field.onClick(idx2d.row, idx2d.col, 0);
    
    should.not.equal(this.field.hasBomb(this.bombCell), true);
    should.equal(this.field.hasBomb(this.freeCell), true);
  }
}