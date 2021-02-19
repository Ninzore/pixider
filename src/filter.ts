import * as fs from "fs-extra";
import {MongoClient} from "mongodb";

const accept_list:string[] = 
["original", "Fate/GrandOrder", "風景", "クリック推奨"]

const filter_list: string[] = ["漫画", "漫画素材工房", "R-18", "R18"];
const filter_artist: string[] = [];

class pfilter {
    private mode: string;

    constructor(mode: string) {
        this.mode = mode;
    }

    public start(date: number) {
        let dir = fs.readdirSync(`${__dirname}/${this.mode}`);
        fs.existsSync(`${__dirname}/${this.mode}_filterd`) ? fs.emptyDirSync(`${__dirname}/${this.mode}_filterd`) : fs.mkdirSync(`${__dirname}/${this.mode}_filterd`);

        dir = dir.filter(file => {
            let rank_date = file.substring(0, 8);
            return parseInt(rank_date) > date
        });

        for (let file of dir) {
            console.log("正在处理", file);
            let data = this.readData(`${__dirname}/${this.mode}/${file}`);
            this.filter(data);
        }
    }

    private readData(filename: string) {
        let data = fs.readJsonSync(filename);
        return data;
    }

    private filter(data) {
        let filted_rank: object = {}
        let filterd: string[] = [];
        let rank = data.contents;

        filted_rank["rank"] = filterd;
        filted_rank["date"] = data.date;

        for (let illust of rank) {
            if (illust.tags.some((tag: string) => {
                if (/^\d+$/.test(tag)) return false;
                return filter_list.some((f_tag: string) => {
                    return RegExp(f_tag).test(tag);
                });
            })) {
                continue;
            } else {
                if (filter_artist.some((name: string) => {return name == illust.user_name})) {
                    continue;
                }
                if (illust.attr == "original") illust.tags.push("original");
                if (illust.tags.some((tag: string) => {
                    // accept_list.includes(tag)
                    return accept_list.some((f_tag: string) => {
                        return RegExp(f_tag).test(tag);
                    });
                })) {
                    filterd.push(illust);
                }
            }
        }
        
        fs.writeJsonSync(`${__dirname}/${this.mode}_filterd/${[data.date, data.page].join("p")}.json`, filted_rank);
    }

    public rmDuplicate() {
        let dir = fs.readdirSync(`${__dirname}/${this.mode}_filterd`);
        let all_pic: {title: string, user_name: string, illust_id: number, tags: string[], url: string}[] = [];
        let ids = new Map();
        let duplicate: number = 0;
        let count: number = 0;

        for (let file of dir) {
            console.log("正在检查", file);
            let data = this.readData(`${__dirname}/${this.mode}_filterd/${file}`);
            
            for (let illust of data.rank) {
                if (!ids.has(illust.illust_id)) {
                    ids.set(illust.illust_id, true);
                    all_pic.push({
                        title: illust.title,
                        user_name: illust.user_name,
                        illust_id: illust.illust_id,
                        tags: illust.tags,
                        url: illust.url.replace("c/240x480/img-master", "img-original")
                                       .replace("_master1200", ""),
                    });
                    count++;
                }
                else {
                    duplicate++;
                }
            }
        }
        console.log(`去除了${duplicate}个重复项`);
        console.log(`总计${count}张图片`);
        fs.writeJsonSync(`${__dirname}/${this.mode}_all.json`, all_pic);
    }

    public classify(min: number) {
        let tags = [];
        let count: number = 0;

        let data = this.readData(`${__dirname}/${this.mode}_all.json`);
        fs.existsSync(`${__dirname}/${this.mode}_tags`) ? fs.emptyDirSync(`${__dirname}/${this.mode}_tags`) : fs.mkdirSync(`${__dirname}/${this.mode}_tags`);

        for (let illust of data) {
            for (let tag of illust.tags) {
                let tag_safe = tag.replace(/["<>?*|:/\\]/g, " ");
                if (tag_safe.trim().length < 1) continue;
                else if (/users入り$/.test(tag)) continue;

                if(!tags[tag]) {
                    tags[tag] = [illust];
                } else tags[tag].push(illust);
            }
        }

        for (let tag in tags) {
            if (tags[tag].length < min) continue;
            let tagged = {illust : tags[tag], tag : tag};
            fs.writeJsonSync(`${__dirname}/${this.mode}_tags/${tag.replace(/["<>?*|:/\\]/g, " ")}.json`, tagged);
            count++;
        }

        console.log(`总共${count.toString()}个tag已分类完成`);
    }

    public mongoStore() {
        let all = fs.readJsonSync(`${__dirname}/${this.mode}_all.json`);
        let tags = fs.readdirSync(`${__dirname}/${this.mode}_tags`);

        const db_port = 27017;
        const db_path = "mongodb://127.0.0.1:" + db_port;
        new MongoClient(db_path, {useUnifiedTopology: true}).connect().then(async mongo => {
            let db = mongo.db('pixiv');
            let illust = db.collection('illust');
            let tag = db.collection("tag");

            illust.drop();
            tag.drop();

            try {
                await illust.insertMany(all);

                for (let current_tag of tags) {
                    let data = this.readData(`${__dirname}/${this.mode}_tags/${current_tag}`);
                    console.log("正在检查", data.tag);
                    let tagged = {
                        illust : data.illust,
                        tag : data.tag
                    }

                    await tag.insertOne(tagged);
                }
            } catch(err) {console.error(err);
            } finally {mongo.close();}
        });
    }

    public sqliteStore() {

    }
}


// let test = filter_list.some((f_tag:string) => {
//     return RegExp(f_tag).test("漫画");
// });

// console.log(test)

let filter = new pfilter('male');
// filter.start(20141220)
// filter.rmDuplicate()
// filter.classify(25)
filter.mongoStore()