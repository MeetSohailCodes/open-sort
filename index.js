import jsonfile from "jsonfile";
import moment from "moment";
import simpleGit from "simple-git";

const path = "./data.json";

// Specific dates you missed (format: YYYY-MM-DD)
const missedDates = [
    // August 2025
    '2025-08-17',
    
    // September 2025
    '2025-09-03',
    '2025-09-04',
    '2025-09-11',
    '2025-09-17',
    '2025-09-18',
    '2025-09-19',
    
    // October 2025
    '2025-10-03',
    '2025-10-04',
    '2025-10-05',
    '2025-10-07',
    '2025-10-11',
    '2025-10-13',
    '2025-10-14',
    '2025-10-15',
    '2025-10-16',
    '2025-10-23',
    '2025-10-24',
    '2025-10-25',
    
    // November 2025
    '2025-11-03',
    '2025-11-05',
    '2025-11-10',
    '2025-11-11',
    '2025-11-24',
    '2025-11-28',
    '2025-11-29',
    
    // December 2025
    '2025-12-05',
    '2025-12-06',
    '2025-12-21',
    '2025-12-22',
    '2025-12-23',
    '2025-12-25',
];

// Number of commits per day (you can adjust this)
const commitsPerDay = 3;

const makeCommits = (dateIndex) => {
    if (dateIndex >= missedDates.length) {
        console.log("All commits completed! Pushing to remote...");
        return simpleGit().push();
    }
    
    const dateStr = missedDates[dateIndex];
    const date = moment(dateStr).format();
    
    // Make multiple commits for this day
    let commitIndex = 0;
    
    const makeCommitForDay = () => {
        if (commitIndex >= commitsPerDay) {
            // Move to next date
            console.log(`Completed commits for ${dateStr}`);
            return makeCommits(dateIndex + 1);
        }
        
        const data = {
            date: date,
            commit: commitIndex + 1,
            day: dateStr
        };
        
        jsonfile.writeFile(path, data, () => {
            const commitMessage = `Update: ${dateStr} - Commit ${commitIndex + 1}`;
            simpleGit()
                .add([path])
                .commit(commitMessage, { "--date": date }, () => {
                    commitIndex++;
                    makeCommitForDay();
                });
        });
    };
    
    makeCommitForDay();
};

console.log(`Starting to create commits for ${missedDates.length} specific dates...`);
console.log(`Will create ${commitsPerDay} commits per day.`);
makeCommits(0);
