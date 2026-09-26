import { writeFileSync } from 'fs';
import { join } from 'path';

function main() {
  const generatedAt = new Date().toISOString();
  const outputPath = join(__dirname, '..', 'src', 'common', 'types', 'generated.types.ts');

  const content = `// Auto-generated scaffold file\nexport const GENERATED_AT = '${generatedAt}';\n`;
  writeFileSync(outputPath, content, 'utf8');
  console.log(`Generated types scaffold at ${outputPath}`);
}

main();

