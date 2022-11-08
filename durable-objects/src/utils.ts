import { Cell } from "./types";

export function isCell(obj: any): obj is Cell {
  return obj
    && typeof obj.color === 'string'
    && typeof obj.x === 'number'
    && typeof obj.y === 'number';
}

export function isCellArray(obj: any): obj is Cell[] {
  return Array.isArray(obj) && obj.every(isCell);
}
