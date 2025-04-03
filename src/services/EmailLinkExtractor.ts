import { Logger } from '../utils/Logger';
import * as cheerio from 'cheerio';

/**
 * Class responsible for extracting various types of links from email content
 * Handles finding tracking pixels, content links, and unsubscribe links
 */
export class EmailLinkExtractor {
    private logger: Logger;

    constructor() {
        this.logger = Logger.instance;
    }

    /**
     * Finds the tracking pixel URL that indicates email opens
     */
    public extractTrackingPixelUrl(emailContent: string): string | null {
        try {
            const $ = cheerio.load(emailContent);

            // First try: Look for tracking pixel with specific 'open' URL pattern
            const trackingImg = $('img[src*="/track/open/"]');
            if (trackingImg.length > 0) {
                return trackingImg.attr('src') || null;
            }

            // Second try: Look for any image with 'track' in the URL
            const fallbackImg = $('img[src*="track"]');
            if (fallbackImg.length > 0) {
                return fallbackImg.attr('src') || null;
            }

            this.logger.warn('Could not find tracking pixel in email content');
            return null;
        } catch (error) {
            this.logger.error(
                `Error extracting tracking pixel URL: ${error instanceof Error ? error.message : String(error)}`
            );
            return null;
        }
    }

    /**
     * Extracts clickable content links, excluding special links like unsubscribe
     */
    public extractContentLinks(emailContent: string): string[] {
        try {
            const $ = cheerio.load(emailContent);
            const links: string[] = [];

            $('a[href]').each((_, element) => {
                const href = $(element).attr('href');

                if (
                    href &&
                    !href.startsWith('javascript:') &&
                    !href.startsWith('mailto:') &&
                    !href.includes('/unsubscribe/') &&
                    !href.includes('/track/unsubscribe/')
                ) {
                    links.push(href);
                }
            });

            this.logger.info(`Found ${links.length} content links in email`);
            return links;
        } catch (error) {
            this.logger.error(
                `Error extracting content links: ${error instanceof Error ? error.message : String(error)}`
            );
            return [];
        }
    }

    /**
     * Finds the unsubscribe link in the email
     */
    public extractUnsubscribeLink(emailContent: string): string | null {
        try {
            const $ = cheerio.load(emailContent);

            const unsubscribeLinks = $('a').filter((_, element) => {
                const href = $(element).attr('href') || '';
                const text = $(element).text().toLowerCase();

                return (
                    href.includes('/unsubscribe/') ||
                    href.includes('/track/unsubscribe/') ||
                    text.includes('unsubscribe') ||
                    text.includes('opt out')
                );
            });

            if (unsubscribeLinks.length > 0) {
                return unsubscribeLinks.first().attr('href') || null;
            }

            this.logger.warn('Could not find unsubscribe link in email content');
            return null;
        } catch (error) {
            this.logger.error(
                `Error extracting unsubscribe link: ${error instanceof Error ? error.message : String(error)}`
            );
            return null;
        }
    }
} 