import events = require('events');
import fs = require('fs');

import {FileSegmentation} from '../utilities/file-segmentation';
import {PathFormatter} from '../utilities/path-formatter';
import {UrlParser} from '../utilities/url-parser';

import {Operation} from "./operation";
import {PartialDownload, PartialDownloadRange} from './partial-download';

export class FileOperation implements Operation {

    private readonly emitter: events.EventEmitter = new events.EventEmitter();
    private downloaders: PartialDownload[] = [];

    public constructor(private saveDirectory: string, private fileName?: string) { }

    public start(url: string, contentLength: number, numOfConnections: number): events.EventEmitter {
        const filePath = this.createFile(url, this.saveDirectory, this.fileName);

        let writeStream: fs.WriteStream;
        let endCounter: number = 0;

        const segmentsRange: PartialDownloadRange[] = FileSegmentation.getSegmentsRange(contentLength, numOfConnections);
        for (let segmentRange of segmentsRange) {

            this.downloaders.push(new PartialDownload()
                .start(url, segmentRange)
                .on('error', (err) => {
                    this.emitter.emit('error', err);
                })
                .on('data', (data, offset) => {
                    this.emitter.emit('data', data, offset);

                    writeStream = fs.createWriteStream(filePath, {flags: 'r+', start: offset});
                    writeStream.write(data);
                })
                .on('end', () => {
                    writeStream.end(() => {
                        if (++endCounter === numOfConnections) {
                            this.emitter.emit('end', filePath);
                        }
                    });
                })
            );
        }

        return this.emitter;
    }

    public stop() {
        for (const downloader of this.downloaders) {
            downloader.stop();
        }
    }

    private createFile(url: string, directory: string, fileName?: string): string {
        const file: string = fileName ? fileName: UrlParser.getFilename(url);

        const filePath: string = PathFormatter.format(directory, file);

        fs.createWriteStream(filePath).end();

        return filePath;
    }
}