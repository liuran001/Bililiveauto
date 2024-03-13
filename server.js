const dotenv = require("dotenv")
dotenv.config()
const express = require('express');
const app = express();
const processFile = require('./processFile')
const appriseNotice = require("./apprise")
const db = require('./database'); // 引入数据库

const PORT = process.env.port || 8081;

app.use(express.json({ extended: false }));

//  POST 请求
app.post('/', function (req, res) {
  const { id, date, type, data } = req.body;
  //读取body中的数据
  res.sendStatus(200);
  console.log(`Webhook: blrec POST 到达 事件：${type}`);
  const { user_info, room_info } = data;
  const text = `分区: ${room_info.parent_area_name} ${room_info.area_name}\n标题: [${room_info.title}](https://live.bilibili.com/${room_info.room_id})`;

  // 判断直播事件：开播、下播、录制、视频后处理完成等
  switch (type) {
    case "VideoPostprocessingCompletedEvent": {
        // 从数据库中获取 rec_date
        const selectSql = `SELECT rec_date, name FROM webhook_events WHERE id = ?`;
        db.get(selectSql, [id], (err, row) => {
          if (err) {
            console.error('VideoPostprocessingCompletedEvent: Error reading from database', err.message);
            return; // 提前返回，避免进一步处理
          }
          if (row) {
            // 如果找到了记录，使用数据库中的 rec_date
            processFile(data.path, data.room_id, row.name, row.rec_date, () => {
              // processFile 的回调函数，确保文件处理完成后再删除数据库记录
              const deleteSql = `DELETE FROM webhook_events WHERE id = ?`;
              db.run(deleteSql, [id], (err) => {
                  if (err) {
                      console.error('Error deleting record', err.message);
                  } else {
                      console.log(`Record deleted for id: ${id}`);
                  }
              });
          });
          } else {
            console.error('VideoPostprocessingCompletedEvent:Not found id from database', err.message);
            return; // 提前返回，避免进一步处理
          }
        });
    break;
    }
    case "LiveBeganEvent": {
      const banner = `BiliLive提醒: "${user_info.name}"的直播开始了，快来看看吧！`;
      appriseNotice(banner, text);
  
      // 首先尝试插入，如果ID已存在，则忽略（因为使用了INSERT OR IGNORE）
      const insertSql = `INSERT OR IGNORE INTO webhook_events (id) VALUES (?)`;
      db.run(insertSql, [id], function(err) {
          if (err) {
              console.error('Error inserting in database', err.message);
          } else {
              console.log(`Inserted or ignored row with id: ${id}`);
              // 如果ID已存在，更新特定字段
              if (this.changes === 0) { // No new row was inserted
              const updateSql = `UPDATE webhook_events SET name = ?, room_id = ? WHERE id = ?`;
              db.run(updateSql, [user_info.name,room_info.room_id,id], function(err) {
                  if (err) {
                      console.error('Error updating database', err.message);
                  } else {
                      console.log(`Updated row with id: ${id}`);
                  }
              });
              }
          }
      });
      break;  
  }
    case "RecordingStartedEvent": {
        const banner = `BiliLive提醒: "${user_info.name}"的直播已经开始录制了！\n如果赶不上直播, 也可以看回放哦!`;
        appriseNotice(banner, text);

        // 首先尝试插入，如果ID已存在，则忽略（因为使用了INSERT OR IGNORE）
        const insertSql = `INSERT OR IGNORE INTO webhook_events (id) VALUES (?)`;
        db.run(insertSql, [id], function(err) {
          if (err) {
            console.error('Error inserting in database', err.message);
          } else {
            console.log(`Inserted or ignored row with id: ${id}`);
            // 如果ID已存在，更新特定字段
            if (this.changes === 0) { // No new row was inserted
                const updateSql = `UPDATE webhook_events SET rec_date = ? WHERE id = ?`;
                db.run(updateSql, [date, id], function(err) {
                    if (err) {
                        console.error('Error updating database', err.message);
                    } else {
                        console.log(`Updated row with id: ${id}`);
                    }
                });
            }
          }
        });

        break;
    }
    case "LiveEndedEvent": {
        const banner = `BiliLive提醒: "${user_info.name}"的直播结束了，欢迎下次再观看！`;
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

