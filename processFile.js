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
 */
async function processFile(filepath) {
  // 从绝对路径获取相对路径
  const relativeFilePath = filepath.split('/').slice(-3).join('/'); // 保留文件名和它的上一级目录

  // 解析 roomid 和 name
  const fileInfo = relativeFilePath.split('/')[0]; // 获取 'roomid - uname' 部分
  const [roomid, name] = fileInfo.split(' - '); // 分别解析出 roomid 和 uname

  // 解析日期和时间
  const filename = relativeFilePath.split('/').pop(); // 获取最后一个部分：文件名
  const dateTimePart = filename.split('_').pop().split('.')[0]; // 从文件名获取日期时间部分，去除扩展名
  const datePart = dateTimePart.substring(0, 10); // 获取日期部分 YYYY-MM-DD
  const timePart = dateTimePart.substring(11); // 获取时间部分 HHMMSS

  // 转换为需要的格式
  const year = datePart.split('-')[0];
  const month = datePart.split('-')[1];
  const day = datePart.split('-')[2];
  const hour = timePart.substring(0, 2);
  const minute = timePart.substring(2, 4);
  const second = timePart.substring(4, 6);
  const timeid = `${year}年${month}月${day}日${hour}时${minute}分${second}秒`;

  console.log(`Room ID: ${roomid}, Name: ${name}, Time ID: ${timeid}`);
  console.log(`Relative File Path: ${relativeFilePath}`);

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
