const admin = require('firebase-admin');

const COLLECTION_TASKS = 'tasks';

const getTaksByIdInDate = async (idTask, month, year) => {
    return await searchTaskInRange(month, year, idTask);
}

async function searchTaskInRange(month, year, idTask) {
    let limitDay = 31;
    console.log('task searching: ' + idTask);
    for(let dayIndex = 1; dayIndex <= limitDay; dayIndex++) {
        let day = dayIndex.toString();
        day = day.length == 1 ? '0' + day : day;
        let dateSearch = day + '-' + month + '-' + year;
        console.log('date searching:' + dateSearch);
        let refTasks = admin.firestore().collection(COLLECTION_TASKS).doc(dateSearch).collection(COLLECTION_TASKS).doc(idTask);
        console.log(refTasks.path);
        let snp = await refTasks.get();
        console.log('data: ' + snp.data());
        if (snp.data() != undefined) {
            return snp.data();
        }
    }
}

// Export functions so they can be used in other files
module.exports = {
    getTaksByIdInDate
};
