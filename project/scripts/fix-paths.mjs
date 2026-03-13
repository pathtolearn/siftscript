import { readFile, writeFile } from 'fs/promises';
import { glob } from 'glob';

async function fixPaths() {
  const htmlFiles = await glob('.output/chrome-mv3/*.html');
  
  for (const file of htmlFiles) {
    let content = await readFile(file, 'utf-8');
    
    // Replace absolute paths with relative paths
    content = content.replace(/href="\/assets\//g, 'href="./assets/');
    content = content.replace(/href="\/chunks\//g, 'href="./chunks/');
    content = content.replace(/src="\/chunks\//g, 'src="./chunks/');
    
    await writeFile(file, content);
    console.log(`Fixed paths in ${file}`);
  }
}

fixPaths().catch(console.error);
