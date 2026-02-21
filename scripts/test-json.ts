import programsData from './src/engine/data/programs.json';
console.log("Keys in programsData:", Object.keys(programsData));
if ('default' in programsData) {
    console.log("programsData is nested under default!");
}
