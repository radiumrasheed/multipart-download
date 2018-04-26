import events = require('events');
import fs = require('fs');

import {FileSegmentation} from '../utilities/file-segmentation';

import {Operation} from "./operation";
import {PartialDownload, PartialDownloadRange} from './partial-download';

export class BufferOperation implements Operation {

    private readonly emitter: events.EventEmitter = new events.EventEmitter();

    public start(url: string, contentLength: number, numOfConnections: number): events.EventEmitter {
        const buffer = Buffer.allocUnsafe(contentLength);

        let endCounter: number = 0;

        const segmentsRange: PartialDownloadRange[] = FileSegmentation.getSegmentsRange(contentLength, numOfConnections);
        for (let segmentRange of segmentsRange) {

            new PartialDownload()
                .start(url, segmentRange)
                .on('error', (pd: PartialDownload, err) => {
                    this.emitter.emit('error', err);
                })
                .on('data', (pd: PartialDownload, data, offset) => {
                    this.emitter.emit('data', data, offset);

                    data.copy(buffer, offset);
                })
                .on('end', (pd: PartialDownload) => {
                    if (++endCounter === numOfConnections) {
                        this.emitter.emit('end', buffer);
                    }
                });
        }

        return this.emitter;
    }
}