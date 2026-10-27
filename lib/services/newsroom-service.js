const newsroom = require('../newsroom.js');

class NewsroomService {
  constructor({ editorialRepository, store }) {
    this.editorialRepo = editorialRepository;
    this.store = store;
  }

  getConfig() {
    const cfg = newsroom.getNewsroomConfig();
    const recentRuns = this.editorialRepo.getNewsroomRuns().slice(0, 20);
    return {
      ...cfg,
      recentRuns
    };
  }

  async runWorkflow(body, actor = 'Editorial Desk') {
    return newsroom.runNewsroomWorkflow(this.store, body, {
      actor,
      sendToReviewQueue: body.sendToReviewQueue !== false
    });
  }
}

module.exports = { NewsroomService };
