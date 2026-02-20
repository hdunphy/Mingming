import fs from 'fs';

function processFile(path) {
    let data = fs.readFileSync(path, 'utf8');
    let json = JSON.parse(data);

    let changed = false;

    // Recursive search for `type: "APPLY_STATUS"` or `type: "REMOVE_STATUS"`
    function traverse(obj) {
        if (Array.isArray(obj)) {
            obj.forEach(traverse);
        } else if (obj !== null && typeof obj === 'object') {
            for (const key in obj) {
                if (key === 'type' && obj[key] === 'APPLY_STATUS') {
                    obj[key] = 'STATUS';
                    changed = true;
                } else if (key === 'type' && obj[key] === 'REMOVE_STATUS') {
                    obj[key] = 'STATUS';
                    obj['stacks'] = -1; // Negative stacks for removal
                    changed = true;
                } else {
                    traverse(obj[key]);
                }
            }
        }
    }

    traverse(json);

    if (changed) {
        fs.writeFileSync(path, JSON.stringify(json, null, 4));
        console.log(`Updated ${path}`);
    } else {
        console.log(`No changes needed for ${path}`);
    }
}

processFile('./src/engine/data/lib/actions.json');
processFile('./src/engine/data/programs.json');
