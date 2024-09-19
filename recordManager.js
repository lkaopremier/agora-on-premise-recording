const { v4: uuidv4 } = require('uuid');
const { spawn } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const Minio = require('minio');

class RecordManager {
    start(appid, channel, storageConfig, callbackUrl) {
        return new Promise((resolve, reject) => {
            const sid = uuidv4();
            
            this.initStorage(appid, channel, sid).then(storagePath => {
                try {
                    console.log('Init recording : ' + sid );

                    if(storageConfig){
                        storageConfig.channel = channel;
                        if (storageConfig.endPoint) {
                            const endpoint = storageConfig.endPoint.replace(/^https?:\/\//, '');
                            const isHttps = storageConfig.endPoint.startsWith('https://');

                            storageConfig.endPoint = endpoint;
                            if(!storageConfig.useSSL){
                                storageConfig.useSSL = isHttps;
                            }
                        }
                        fs.writeFileSync(path.join(storagePath, 'storage.json'), JSON.stringify(storageConfig));
                    }

                    const command = 'recorder';
                    const args = [
                        '--appId', appid,
                        '--uid', 0,
                        '--channel', channel,
                        '--isAudioOnly', '1',
                        '--isMixingEnabled', '1',
                        '--channelProfile', '0',
                        '--recordFileRootDir', path.resolve(__dirname, `./output/${sid}`),
                        '--appliteDir', "/opt/agora_recorder/bin"
                    ];

                    const process = spawn(command, args, {
                        detached: true,
                        stdio: ['ignore', fs.openSync(`${storagePath}/output.log`, 'w'), fs.openSync(`${storagePath}/output.log`, 'w')]
                    });

                    process.unref();

                    process.on('close', (code) => {
                        console.log('End '+ sid +' recording' );

                        const pidpath = path.resolve(__dirname, `./output/${sid}`, 'pid');
                        
                        if(fs.existsSync(pidpath)){
                            fs.unlinkSync(pidpath);
                        }

                        const storagePathname = path.resolve(__dirname, `./output/${sid}`, 'storage.json');
                        if(fs.existsSync(storagePathname)){
                            const storage = JSON.parse(fs.readFileSync(storagePathname, 'utf8'));
                            this.sendFileToCloud(sid, storage)
                            .then(() => {
                                console.log('file sent to cloud');

                                if(callbackUrl){
                                    console.log('Call '+ sid +' callback' );

                                    this.onSendFileToCloud(sid, callbackUrl);
                                }
                            }).catch((e) => {
                                fs.unlinkSync(storagePathname);
                                console.log('failed to send file to cloud ' + e);
                            });
                        }
                    });

                    if(process.pid){
                        fs.writeFileSync(path.join(storagePath, 'pid'), process.pid.toString());
                    }else{
                        reject(new Error('failed to start recorder'));
                    }

                    resolve({
                        sid,
                        appid,
                        channel,
                    });
                } catch (error) {
                    reject(error);
                }
            }).catch((e) => {
                reject(e);
            });
        });
    }

    initStorage(appid, channel, sid) {
        return new Promise((resolve, reject) => {
            const storagePath = path.resolve(__dirname, `./output/${sid}`);
            fs.mkdir(storagePath, {recursive: true}, err => {
                if(err){
                    throw err;
                }
                resolve(storagePath);
            });
        })
    }

    status(sid) {
        const storagePath = path.resolve(__dirname, `./output/${sid}`);

        if(fs.existsSync(storagePath)){
            return fs.existsSync(path.join(storagePath, 'pid')) ? "RUNNING" : "STOPPED";
        }else{
            throw new Error('recorder not exists');
        }
    }

    clean(sid) {
        const storagePath = path.resolve(__dirname, `./output/${sid}`);

        if(fs.existsSync(storagePath)){
            return fs.unlinkSync(storagePath);
        }else{
            throw new Error('recorder not exists');
        }
    }

    getStorageFiles(sid) {
        const storagePath = path.resolve(__dirname, `./output/${sid}`, 'storage.log');
        if(!fs.existsSync(storagePath)) return {};
        return JSON.parse(fs.readFileSync(storagePath, 'utf8'));
    }

    onSendFileToCloud(sid, callbackUrl){
        const storageFiles = this.getStorageFiles(sid);

        if(Object.keys(storageFiles).length){
            const data = {
                sid,
                files: storageFiles,
            };

            fetch(callbackUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(data)
            })
            .then(response => response.json())
            .then(data => {
                console.log('Callback '+ sid +' success:', data);
            })
            .catch((error) => {
                console.error('Callback '+ sid +' error:', error);
            });
        }
    }

    stop(sid) {
        const status = this.status(sid);
        
        if(status !== "RUNNING"){
            throw new Error('recorder already stopped');
        }

        const pidpath = path.resolve(__dirname, `./output/${sid}`, 'pid');

        try {
            const pid = fs.readFileSync(pidpath, 'utf8');
            process.kill(-parseInt(pid));
            fs.unlinkSync(pidpath);
        } catch (error) {
            throw new Error('recorder not exists');
        }
    }

    sendFileToCloud(sid, storageConfig){
        return new Promise(async (resolve, reject) =>  {
            const files = this.getFiles(sid);

            if(files.length === 0){
                reject(new Error('no files to send'));
            }

            try {
                const minioClient = new Minio.Client({
                    endPoint: storageConfig.endPoint,
                    port: storageConfig.port,
                    useSSL: storageConfig.useSSL || false,
                    accessKey: storageConfig.accessKey,
                    secretKey: storageConfig.secretKey,
                });

                if(!storageConfig.bucket){
                    reject(new Error('bucket not defined'));
                }

                const exists = await minioClient.bucketExists(storageConfig.bucket)

                if (!exists) {
                  await minioClient.makeBucket(storageConfig.bucket, storageConfig.bucket || 'us-east-1');
                }

                let uploads = {};

                for(const key in files){
                    const file = files[key];
                    
                    const destinationObject = `${sid}_${key}_${path.basename(file)}`;
                    
                    await minioClient.fPutObject(storageConfig.bucket, destinationObject, file, { sid });

                    uploads[destinationObject] = {
                        sid,
                        filename: destinationObject,
                        size: fs.statSync(file).size,
                        bucket: storageConfig.bucket,
                        region: storageConfig.region,
                        channel: storageConfig.channel,
                    };
                    
                    fs.unlinkSync(file);
                }
                
                if(Object.keys(uploads).length){
                    fs.writeFileSync(path.resolve(__dirname, `./output/${sid}`, 'storage.log'), JSON.stringify(uploads));
                }
                
                fs.readdirSync(path.resolve(__dirname, `./output/${sid}`)).forEach((file) => {
                    if (file !== 'storage.log') {
                        fs.rmSync(path.resolve(__dirname, `./output/${sid}`, file), { recursive: true });
                    }
                });

                resolve(true);
            } catch (error) {
                reject(error);
            }
        });
    }

    getFiles(sid, pathname = null){
        let files = [];

        const filename = pathname || path.resolve(__dirname, `./output/${sid}`);

        for(const file of fs.readdirSync(filename)){
            const absPath = path.join(filename, file);
            if(fs.statSync(absPath).isDirectory()){
                files = files.concat(this.getFiles(sid, absPath));
            }else{
                if(!absPath.endsWith('.aac')) continue;
                files.push(absPath);
            }
        }
        
        return files;
    }
}

module.exports = new RecordManager();