import { MANGASEE_DISABLED, MANGASEE_REFRESH_INTERVAL } from "../constants/constants.js";
import { MangaChapter } from "../model/MangaChapter.js";
import { MessengerTopic } from "../util/imm.js";
import { Logger } from "../util/logger.js";
import { Mangasee } from "../util/mangasee.js";
import { Store } from "../util/store.js";

export class MangaseeScraperImpl {

  logger: Logger;
  // Sets of seen chapters
  seenUrls: Set<string>;

  constructor() {
    this.seenUrls = new Set();
    this.logger = new Logger("MangaseeScraper");
  }

  public init(): void {
    // If disabled in env, don't start timerTask
    if (MANGASEE_DISABLED) {
      this.logger.error("Mangasee parsing explicitly disabled");
      return;
    }

    if (isNaN(MANGASEE_REFRESH_INTERVAL)) {
      this.logger.error("Invalid refresh interval for Mangasee");
      return;
    }

    // Run timerTask at regular intervals 
    setInterval(this.timerTask, MANGASEE_REFRESH_INTERVAL);
  }

  private timerTask = async (): Promise<void> => {
    this.logger.info('Running Mangasee scraper', 4);

    try {
      // Fetch chapters from now back until the last refresh interval
      const fetchToDate = new Date(Date.now() - MANGASEE_REFRESH_INTERVAL * 2);
      const latestChapters = await Mangasee.getLatestChapters(null);

      latestChapters.forEach(async c => {
        // Avoid double notifications
        if (this.seenUrls.has(c.link)) {
          return;
        }
        this.seenUrls.add(c.link);
        
        this.logger.info(`New Mangasee item: ${c.seriesName} | ${c.chapterNumber}`, 3);

        // Get the titleId for the series
        // If none exists, we don't have anything to go off to send notifications
        const titleId = await Store.getTitleIdForAlt(c.seriesName);
        if (titleId == null) {
          return;
        }

        const mChapter = new MangaChapter();
        mChapter.link = c.link;
        mChapter.titleId = titleId;
        mChapter.chapterNumber = c.chapterNumber;
        mChapter.pageCount = null;

        this.logger.info(`New Mangasee item: ${mChapter.titleId} | ${mChapter.chapterNumber}`, 3);
        NewMangaseeItemTopic.notify(mChapter);
      });
    } catch (e) {
      this.logger.error(e);
    }
  }
}

export const MangaseeScraper = new MangaseeScraperImpl();

export const NewMangaseeItemTopic = new MessengerTopic<MangaChapter>("NewMangaseeItemTopic");