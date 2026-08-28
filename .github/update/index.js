async function update() {
    console.log('Starting update process...');
}

update().catch(error => {
    console.error('Update failed:', error);
    process.exit(1);
});