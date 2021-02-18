import axios from "axios";
import * as fs from "fs-extra";
import { exit } from "process";

class pixivFetch {
    private dateFrom:string;
    private dateEnd:string;
    private currentDate:string;
    private mode:string;
    public page:number;
    private retry:number;
    public retryTimes:number;

    constructor(mode:string, dateFrom:string = "0", dateEnd:string = "0") {
        this.mode = mode;
        this.dateFrom = dateFrom == "0" ? this.dateString(this.changeDays(new Date, -2)) : dateFrom;
        this.dateEnd = dateEnd == "0" ? "2009-01-01" : dateFrom;
        this.retry = 0;
        this.retryTimes = 5;
    }

    private reqForm(currentDate:string) {
        let form = {
            url : "https://www.pixiv.net/ranking.php",
            method : "GET",
            header : "",
            params : {
                date : currentDate,
                mode : this.mode,
                // content : "illust", 
                format : "json",
                p : this.page
            }
        }   
    }

    private randomDelay(delay:number):number {
        return delay * Math.random();
    }

    private errorHandle(err) {
        if (this.retry > this.retryTimes) {
            console.error("已超出预定重试次数，结束");
            exit(1);
        }
        else {
            this.retry ++;
            console.error("准备重试");
            this.scraper(err.config.params.date, err.config.params.mode);
        }
    }

    public async fetchRank(date:string, mode:string, page:string):Promise<string> {
        return axios({
            url : "https://www.pixiv.net/ranking.php",
            method : "get",
            params : {
                date : date,
                mode : mode,
                content : "illust",
                format : "json",
                p : page
            }
        }).then(res => {
            fs.writeJsonSync(`${__dirname}/${mode}/${[date, page].join("p")}.json`, res.data);
            return res.data.prev_date;
        }).catch(err => {
            if ("response" in err && "status" in err.response) {
                if (err.response.status == 404) {
                    console.error("错误：该日期不存在或者该日期无此分类");
                    exit(404);
                }
                else {
                    console.error("错误：", err.response.status);
                    this.errorHandle(err);
                }
            }
            else {
                console.error("错误：", "文件写入失败", err);
                this.errorHandle(err);
            }
        })
    }

    private dateString(date: Date):string {
        let month = (date.getMonth() + 1).toString();
        month = month.length > 1 ? month : `0${month}`;
        let day = date.getDate().toString();
        day = day.length > 1 ? day : `0${day}`;
        return `${date.getFullYear()}${month}${day}`;
    }
    
    private changeDays(date: Date, days: number = -1):Date {
        return new Date(date.setDate(date.getDate() + days));
    }
    
    private scraper(date: string, mode: string) {
        setTimeout(() => {
            console.log("正在进行：", date);
            this.fetchRank(date, mode, "1").then(prev => prev ? this.scraper(prev, mode) : console.log("错误日期：", date));
        }, this.randomDelay(5));
    }
    
    public run(date: Date) {
        fs.existsSync(`${__dirname}/${this.mode}`) ? true : fs.mkdirSync(`${__dirname}/${this.mode}`);
        let init_date = this.dateString(date);
        this.scraper(init_date, this.mode)
    }
}


// fetchRank("20200822", "1");
// let date_string:string = dateString(date);
let pfetch = new pixivFetch("daily", "2020-09-02", "2020-08-31")
pfetch.run(new Date(Date.parse("2020-09-01")));