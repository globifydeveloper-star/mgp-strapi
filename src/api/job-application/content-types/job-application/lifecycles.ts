export default {
  beforeCreate(event: { params: { data: Record<string, any> } }) {
    if (event.params && event.params.data) {
      // Force status to "New" regardless of what public request passed
      event.params.data.status = 'New';
    }
  },
};
