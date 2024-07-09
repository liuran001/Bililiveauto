const dotenv = require("dotenv");
dotenv.config();
const express = require('express');
const axios = require('axios');
const cheerio = require('cheerio');
const app = express();
const processFile = require('./processFile');
const appriseNotice = require("./apprise");

const PORT = process.env.port || 8081;

app.use(express.json({ extended: false }));

// Function to get username from UID
async function getUsernameFromUID(uid) {
  try {
    const url = `https://space.bilibili.com/${uid}`;
    const userAgent = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
    const response = await axios.get(url, {
      headers: {
        'User-Agent': userAgent
      }
    });
    const html = response.data;
    const $ = cheerio.load(html);
    const title = $('title').text();
    const name = title.split('的个人空间')[0];
    return name;
  } catch (error) {
    console.error('Error fetching the username:', error);
    return `用户${uid}`; // Return a default name if fetching fails
  }
}

//  POST 请求
app.post('/', async function (req, res) {
  const { id, date, type, data } = req.body;
  //读取body中的数据
  res.sendStatus(200);
  console.log(`Webhook: blrec POST 到达 事件：${type}`);

  // 判断直播事件：开播、下播、录制、视频后处理完成等
  switch (type) {
    case "VideoPostprocessingCompletedEvent": {
      processFile(data.path);
      break;
    }
    case "LiveBeganEvent": {
      const { user_info, room_info } = data;
      const text = `分区: ${room_info.parent_area_name} ${room_info.area_name}\n标题: [${room_info.title}](https://live.bilibili.com/${room_info.room_id})\n#id_${room_info.room_id} #开播`;
      const banner = `BakaREC 提醒: "${user_info.name}"的直播开始了，快来看看吧！`;
      appriseNotice(banner, text);
      break;  
    }
    case "RecordingStartedEvent": {
      const { user_info, room_info } = data;
      const username = await getUsernameFromUID(room_info.uid);
      const text = `分区: ${room_info.parent_area_name} ${room_info.area_name}\n标题: [${room_info.title}](https://live.bilibili.com/${room_info.room_id})\n#id_${room_info.room_id} #开始录制`;
      const banner = `BakaREC 提醒: "${username}"的直播已经开始录制了！\n如果赶不上直播, 也可以看回放哦!`;
      appriseNotice(banner, text);
      break;
    }
    case "LiveEndedEvent": {
      const { user_info, room_info } = data;
      const text = `分区: ${room_info.parent_area_name} ${room_info.area_name}\n标题: [${room_info.title}](https://live.bilibili.com/${room_info.room_id})\n#id_${room_info.room_id} #下播`;
      const banner = `BakaREC 提醒: "${user_info.name}"的直播结束了，欢迎下次再观看！`;
      appriseNotice(banner, text);
      break;
    }
    default: {
      console.log(`Webhook: 判断类型: ${type} => 提醒未发送`);
    }
  };
})

//监听端口
const server = app.listen(PORT, function () {
  const { address, port } = server.address();
  console.log(`BiliLiveAuto脚本正在运行, 地址为 http://${address}:${port}`);
})
