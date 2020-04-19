import * as fs from 'fs';
import { Owning } from '../models/owning.model';
// We need this import so TypeScript puts the file in the build at the compilation
import * as owns from '../saves/ownings.json';

const owningFilePath = 'saves/ownings.json';

export function addOwning(owning: Owning) {
  const owningFile = fs.readFileSync(owningFilePath, 'utf-8');
  const ownings = JSON.parse(owningFile);
  const newOwnings = [
    ...ownings,
    owning
  ];
  fs.writeFileSync(owningFilePath, JSON.stringify(newOwnings), 'utf-8');
}

export function editOwning() {};

export function removeOwning(channelId: string) {
  const owningFile = fs.readFileSync(owningFilePath, 'utf-8');
  const ownings = JSON.parse(owningFile);
  const newOwnings = ownings.filter((owning: Owning) => owning.ownedChannelId !== channelId);
  fs.writeFileSync(owningFilePath, JSON.stringify(newOwnings), 'utf-8');
}
