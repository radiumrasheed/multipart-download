import events = require('events');

import {Validation} from '../utilities/validation';

import {AcceptRanges} from './accept-ranges';
import {Operation} from "./operation";
import {OperationFactory} from './operation-factory';
import {PartialRequestQuery, PartialRequestMetadata} from './partial-request-query';
import {StartOptions} from './start-options';

export interface MultipartOperation {
    start(url: string, options?: StartOptions): MultipartOperation;
}

export class MultipartDownload extends events.EventEmitter implements MultipartOperation {
    private static readonly DEFAULT_NUMBER_OF_CONNECTIONS: number = 1;
    private static readonly SINGLE_CONNECTION: number = 1;

    public start(url: string, startOptions?: StartOptions): MultipartDownload {
        const options: StartOptions = this.getOptions(startOptions);

        const validationError: Error = this.validateInputs(url, options);
        if (validationError) {
            this.emit('error', validationError);
        }

        this.execute(url, options);

        return this;
    }

    private getOptions(startOptions?: StartOptions): StartOptions {
        let connections: number = MultipartDownload.DEFAULT_NUMBER_OF_CONNECTIONS;
        let directory: string;
        let file: string;
        let metadataPathPrefix = '';
        let metadataPathExtension = 'dat';
        let resume = true;

        if (startOptions) {
            connections = startOptions.numOfConnections ?
                            startOptions.numOfConnections : connections;

            directory = startOptions.saveDirectory;
            file = startOptions.fileName;
            metadataPathPrefix = startOptions.metadataPathPrefix || metadataPathPrefix;
            metadataPathExtension = startOptions.metadataPathExtension || metadataPathExtension;
            resume = startOptions.resume || resume;
        }

        const options: StartOptions = {
            numOfConnections: connections,
            saveDirectory: directory,
            fileName: file,
            resume: resume,
            metadataPathPrefix: metadataPathPrefix,
            metadataPathExtension: metadataPathExtension
        };

        return options;
    }

    private execute(url: string, options: StartOptions): void {
        new PartialRequestQuery()
            .getMetadata(url)
            .then((metadata) => {

                const metadataError: Error = this.validateMetadata(url, metadata);
                if (metadataError) {
                    this.emit('error', metadataError);
                }

                if (metadata.acceptRanges !== AcceptRanges.Bytes) {
                    options.numOfConnections = MultipartDownload.SINGLE_CONNECTION;
                }

                const operation: Operation = OperationFactory.getOperation(options);
                operation
                    .start(url, metadata.contentLength, options.numOfConnections)
                    .on('error', (err, range) => {
                        this.emit('error', err, range);
                    })
                    .on('data', (data, offset, range) => {
                        this.emit('data', data, offset, range);
                    })
                    .on('end', (output) => {
                        this.emit('end', output);
                    })
                    .on('progress', (progress) => {
                        this.emit('progress', progress);
                    });
            })
            .catch((err) => {
                this.emit('error', err);
            });
    }

    private validateInputs(url: string, options: StartOptions): Error {
        if (!Validation.isUrl(url)) {
            return new Error('Invalid URL provided');
        }

        if (!Validation.isValidNumberOfConnections(options.numOfConnections)) {
            return new Error('Invalid number of connections provided');
        }

        if (options.saveDirectory && !Validation.isDirectory(options.saveDirectory)) {
            return new Error('Invalid save directory provided');
        }

        if (options.fileName && !Validation.isValidFileName(options.fileName)) {
            return new Error('Invalid file name provided');
        }

        return null;
    }

    private validateMetadata(url: string, metadata: PartialRequestMetadata): Error {
        if (isNaN(metadata.contentLength)) {
            return new Error(`Failed to query Content-Length of ${url}`);
        }

        return null;
    }
}