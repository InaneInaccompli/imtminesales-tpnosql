import { createReadStream } from 'fs';
import csv from 'csv-parser';

const parseCSV = (filePath, headers, limit = null) => {
    return new Promise((resolve, reject) => {
        const results = [];
        let count = 0;
        const stream = createReadStream(filePath)
            .pipe(csv({ headers: false }));

        stream.on('data', (data) => {
                 if (limit && count >= limit) {
                     // We can't easily destroy stream here without complications in some node versions, 
                     // but we can just stop pushing.
                     return; 
                 }
                 const row = {};
                 headers.forEach((h, i) => row[h] = data[i]);
                 results.push(row);
                 count++;
            })
            .on('end', () => resolve(results))
            .on('error', (err) => reject(err));
    });
};

export default { parseCSV };
