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
  // 从绝对路径中移除前缀部分（例如 '/rec/'），保留之后的部分作为 relativeFilePath
  const relativeFilePath = filepath.substring(filepath.indexOf('/rec/') + 5); // '+ 5' 是为了跳过 '/rec/' 部分

  // 移除文件扩展名来获取 filepathNoExtension
  const filepathNoExtension = relativeFilePath.split('.').slice(0, -1).join('.'); // 移除最后的扩展名部分

  // 从 relativeFilePath 获取 roomid 和 name
  const roomAndName = relativeFilePath.split('/')[0]; // '26630186 - 烈火游戏机娱乐'
  const roomid = roomAndName.split(' - ')[0]; // '26630186'
  const name = roomAndName.split(' - ')[1]; // '烈火游戏机娱乐'

  // 解析日期和时间
  const filename = relativeFilePath.split('/')[1]; // '街机烈火舞萌DX实时直播_26630186_2024-03-14-020708.mp4'
  const dateTimePart = filename.split('_').pop().split('.')[0]; // '2024-03-14-020708'
  const [year, month, day, rest] = dateTimePart.split('-'); // 提取日期和时间
  const hour = rest.substring(0, 2);
  const minute = rest.substring(2, 4);
  const second = rest.substring(4, 6);
  const timeid = `${year}年${month}月${day}日${hour}时${minute}分${second}秒`;

  console.log(`Room ID: ${roomid}, Name: ${name}, Time ID: ${timeid}`);
  console.log(`Relative File Path: ${relativeFilePath}`);
  console.log(`File Path Without Extension: ${filepathNoExtension}`);

    /**
 * 上传指定格式的文件到rclone
 * @param {string} uploadFormat - 待上传的文件格式
 */
async function rcUpload(uploadFormat) {
    debug && console.log(`上传 ${uploadFormat} 至 ${rclonePath}/${roomid}-${name}/${timeid}/`);
    await new Promise((resolve, reject) => {
        const results = rclone.copy(`${bilifilePath}/${filepathNoExtension}.${uploadFormat}`, `${rclonePath}/${roomid}-${name}/${timeid}/`, {
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
                    deleteFile(`${bilifilePath}/${filepathNoExtension}.${uploadFormat}`);
                }
                if (noticeFileUploaded && noticeFileFormat.includes(uploadFormat)) {
                    const encodedRoomid = encodeURIComponent(`${roomid}-${name}`);
                    const encodedTimeid = encodeURIComponent(timeid);
                    const encodedFilename = encodeURIComponent(`${filepathNoExtension}.${uploadFormat}`);
                    const fileUrl = `https://file.obdo.cc/B%E7%AB%99%E5%BD%95%E6%92%AD/${encodedRoomid}/${encodedTimeid}/${encodedFilename}`;
                    
                    appriseNotice(
                        `BakaREC 提醒: "${name}"的直播录像文件上传成功`,
                        `文件名：${roomid}-${name}/${timeid}/${filepathNoExtension}.${uploadFormat}\n录像链接：${fileUrl}\n文件更新有延迟，如果打不开请等待十分钟哦~\n#id_${roomid} #上传完成`
                    );
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
