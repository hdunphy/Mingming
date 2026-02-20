import fs from 'fs';

function migrateArray(actions) {
    let newActions = [];
    let changed = false;
    for (let action of actions) {
        if (action.count !== undefined && action.type !== 'DRAW') {
            let count = action.count;
            delete action.count;
            for (let i = 0; i < count; i++) {
                newActions.push({ ...action }); // Duplicate the action
            }
            changed = true;
        } else if (action.type === 'DRAW' && action.count !== undefined) {
            // Rename count to amount for DRAW
            action.amount = action.count;
            delete action.count;
            newActions.push(action);
            changed = true;
        } else {
            newActions.push(action);
        }
    }
    return { newActions, changed };
}

function processActionsLib(path) {
    let data = fs.readFileSync(path, 'utf8');
    let json = JSON.parse(data);
    let changed = false;

    for (let key in json) {
        let action = json[key];
        if (action.type === 'DRAW' && action.count !== undefined) {
            action.amount = action.count;
            delete action.count;
            changed = true;
        }
    }

    if (changed) {
        fs.writeFileSync(path, JSON.stringify(json, null, 4));
        console.log(`Updated ${path}`);
    } else {
        console.log(`No changes needed for ${path}`);
    }
}

function processPrograms(path) {
    let data = fs.readFileSync(path, 'utf8');
    let json = JSON.parse(data);

    let fileChanged = false;

    for (let key in json) {
        if (json[key].actions) {
            let res = migrateArray(json[key].actions);
            if (res.changed) {
                json[key].actions = res.newActions;
                fileChanged = true;
            }
        }
    }

    if (fileChanged) {
        fs.writeFileSync(path, JSON.stringify(json, null, 4));
        console.log(`Updated ${path}`);
    } else {
        console.log(`No changes needed for ${path}`);
    }
}

processActionsLib('./src/engine/data/lib/actions.json');
processPrograms('./src/engine/data/programs.json');
