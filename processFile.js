const dotenv = require("dotenv");
dotenv.config();
const fs = require("fs");
const { spawn } = require("child_process");
const moment = require("moment-timezone");
const rclone = require("rclone.js");
const appriseNotice = require("./apprise");

const rclonePath = process.env.RCLONE_PATH;
const bilifilePath = process.env.BILI_FILE_PATH;
const timezone = process.env.TZ;
const noticeFileFormat = process.env.NOTICE_FILE_FORMAT;
const debug = process.env.DEBUG === "true";
const uploadOrigin = process.env.UPLOAD_ORIGIN === "true";
const deleteLocal = process.env.DELETE_LOCAL === "true";
const noticeFileUploaded = process.env.NOTICE_FILE_UPLOADED === "true";

/**
 * 删除指定路径下的文件
 * @param {string} filePath - 文件路径
 */
function deleteFile(filePath) {
    fs.unlink(filePath, (err) => {
        if (err) {
            console.error(`删除文件错误：${err}`);
            return;
        }
        debug && console.log(`文件 ${filePath} 已成功删除`);
    });
}

/**
 * 处理直播录像文件
 * @param {string} filepath - 录像文件绝对路径
 * @param {string} roomid - 直播房间ID
 * @param {string} name - 直播主播名称
 * @param {string} fileopentime - 录像文件开始时间
 */
async function processFile(filepath, roomid, name, fileopentime) {
    // 从绝对路径获取相对路径
    const relativePathArray = filepath.split('/').slice(-2); // 获取最后两个元素作为相对路径
    const relativeFilePath = relativePathArray.join('/'); // 重新组合成相对路径字符串
    const filepathNoExtension = relativeFilePath.slice(0, -4); // 去除文件扩展名
    const timeid = moment(fileopentime)
        .tz(timezone)
        .format("YYYY年MM月DD日HH时mm分ss秒SSS");

    /**
     * 上传指定格式的文件到rclone
     * @param {string} uploadFormat - 待上传的文件格式
     */
    async function rcUpload(uploadFormat) {
        debug && console.log(`上传 ${uploadFormat} 至 ${rclonePath}/${roomid}-${name}/${timeid}/`);
        await new Promise((resolve, reject) => {
            const results = rclone.copy(`${bilifilePath}/${relativeFilePath}`, `${rclonePath}/${roomid}-${name}/${timeid}/`, {
                "ignore-errors": true
            });
            results.stdout.on("data", (data) => {
                debug && console.log(`stdout: ${data}`);
            });
            results.stderr.on("data", (data) => {
                console.error(`上传 ${uploadFormat} 失败，错误：${data}`);
                reject(new Error(`上传 ${uploadFormat} 失败`));
            });
            results.on("close", (code) => {
                if (code === 0) {
                    console.log(`上传 ${uploadFormat} 成功`);
                    if (deleteLocal) {
                        deleteFile(`${bilifilePath}/${relativeFilePath}`);
                    }
                    if (noticeFileUploaded && noticeFileFormat.includes(uploadFormat)) {
                        appriseNotice(`BiliLive提醒: "${name}"的直播录像文件上传成功`, `文件名：${relativeFilePath}`);
                    }
                    resolve();
                } else {
                    reject(new Error(`上传 ${uploadFormat} 失败，返回码：${code}`));
                }
            });
        });
    }

    // 上传mp4文件
    try {
        await rcUpload('mp4');
        await rcUpload('xml');
    } catch (error) {
        console.error(`上传文件失败：${error.message}`);
        const text = `文件路径: ${roomid}-${name}/${timeid}`;
        const banner = `BiliLive提醒: [${name}](https://live.bilibili.com/${roomid})的直播文件部分上传失败！⚠请及时查阅！`;
        appriseNotice(banner, text);
    }
}

module.exports = processFile;
