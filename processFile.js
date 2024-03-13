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

async function processFile(filepath) {
  // 从绝对路径获取相对路径
  const pathComponents = filepath.split('/'); // 分割整个文件路径
  const relativeFilePath = pathComponents.slice(-3).join('/'); // 获取相对路径，包括文件名和上一级两级目录

  // 解析 roomid 和 name
  const roomInfo = pathComponents[pathComponents.length - 2]; // 获取 'roomid - uname' 部分
  const roomidMatch = roomInfo.match(/\b\d+\b/); // 正则表达式查找数字（roomid）
  const roomid = roomidMatch ? roomidMatch[0] : 'Unknown'; // 提取 roomid 或使用 'Unknown'
  const name = roomInfo.split(' - ').pop(); // 假设 name 是 ' - ' 后面的部分

  // 解析日期和时间
  const filename = pathComponents.pop(); // 获取最后一个部分：文件名
  const dateTimePart = filename.split('_').pop().replace('.mp4', ''); // 从文件名获取日期时间部分，去除扩展名
  const [year, month, day, rest] = dateTimePart.split('-'); // 按破折号分割日期时间
  const hour = rest.substring(0, 2);
  const minute = rest.substring(2, 4);
  const second = rest.substring(4, 6);
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
