// The published Windows 3.1.3 executable starts without invoking its launcher.
// Execute the official, unmodified launcher with its bundled Bun interpreter.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
globalThis.SYNERGY_STANDALONE = true;
globalThis.SYNERGY_VERSION = '3.1.3';
const entry=resolve('.tools/synergy/node_modules/@ericsanchezok/synergy-windows-x64/runtime/node_modules/@ericsanchezok/synergy-cli/dist/modules/launcher.js');
await (await import(pathToFileURL(entry).href)).launch();
