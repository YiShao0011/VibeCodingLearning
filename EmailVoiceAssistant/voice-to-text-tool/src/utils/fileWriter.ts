import { writeFileSync } from 'fs';

export function writeTextToFile(text: string, filePath: string): void {
    writeFileSync(filePath, text, { encoding: 'utf8' });
}
import { promises as fs } from 'fs';
import path from 'path';

export async function writeToFile(fileName: string, data: string): Promise<void> {
    const filePath = path.join(__dirname, '..', '..', 'output', fileName);
    await fs.writeFile(filePath, data, 'utf8');
}