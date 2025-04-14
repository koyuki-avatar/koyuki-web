// joy.d.ts
declare class JoyStick {
  constructor(containerId: string, parameters?: any, callback?: (status: StickStatus) => void);
  GetX(): number;
  GetY(): number;
  GetPosX(): number;
  GetPosY(): number;
  GetDir(): string;
  SetXY?(x: number, y: number): void;
}

interface StickStatus {
  xPosition: number;
  yPosition: number;
  x: number;
  y: number;
  cardinalDirection: string;
}
