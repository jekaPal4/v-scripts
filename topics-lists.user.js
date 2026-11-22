// ==UserScript==
// @name    Списки постов
// @namespace  Violentmonkey Scripts
// @description Cписки постов для выгрузки в файл
// @author  jeka
// @version  0.1.1
// @match   https://ok.ru/*
// @grant   GM_registerMenuCommand
// @grant   GM_unregisterMenuCommand
// @grant   GM_getValue
// @grant   GM_setValue
// @grant   GM_xmlhttpRequest
// @grant   GM_download
// @grant   GM_notification
// ==/UserScript==

(()=>{
    setTimeout(
        function run(){
            findTopcs();
            setTimeout(run, 7e3);
        },
        1000 
    );

    const observer = new MutationObserver((mutations) => {
        mutations.forEach(initTopicsMyMenu);
    });
    const observConfig = {
        childList: true,
        subtree: true,
        attributes: false,
        characterData: false,
    };


    const topicsLists = JSON.parse(GM_getValue('topicsLists', '{"первый":{}}'));

    function saveListsDb(){
        GM_setValue('topicsLists', JSON.stringify(topicsLists));
    }

    function initTopicsMyMenu(mut){
        const elem = mut.target.querySelector('ul.u-menu');

        if(!elem || !elem.querySelector('[data-module="BookmarkUpdateStatusNotifier"],a[data-l="t,now"],a[data-l="t,my-msg"],a[data-l="t,addBookmark"],a[data-l="t,bookmarks_feed_add_link"],li[data-l*="editTopic"'))return;

        let elementTopic = elem.closest('.feed-w') || document.querySelector('#mtLayer.__active,.feed_menu.__vis,.feed-action_trigger.__vis');

        if(elementTopic && elementTopic.classList.contains('feed-action_trigger')){
            elementTopic = elementTopic.closest('.feed[id^="hook_Block_mediatopic_"]');
        }

        const topicInfo = getTopicInfo(elementTopic);

        if(!topicInfo || !topicInfo.tid || (!topicInfo.gid && !topicInfo.uid))return;
        topicInfo.url = (topicInfo.gid ? `/group/${topicInfo.gid}/topic/` : `/profile/${topicInfo.uid}/statuses/`)+topicInfo.tid;


        const itemsClearList = elem.querySelectorAll('.myli');
        itemsClearList.forEach(elem=>elem.remove());


        
        Object.keys(topicsLists).forEach(listName=>{
            const topicCount = Object.keys(topicsLists[listName]).length;

            let iconTitle = '<svg class="svg-ic svg-ico_add_circle_16 tico_img" viewBox="0 0 16 16"><path fill-rule="evenodd" clip-rule="evenodd" fill="#999" d="M8 .7A7.3 7.3 0 1 0 8 15.3 7.3 7.3 0 0 0 8 .7zm0 1.6a5.7 5.7 0 1 1 0 11.4A5.7 5.7 0 0 1 8 2.3zm-.8 2.3a.8.8 0 1 1 1.6 0v2.6h2.6a.8.8 0 1 1 0 1.6H8.8v2.6a.8.8 0 1 1-1.6 0V8.8H4.6a.8.8 0 1 1 0-1.6h2.6V4.6z"></path></svg>В список '+listName;
            if(topicsLists[listName][topicInfo.tid])iconTitle = '<svg class="svg-ic tico_img" viewBox="0 0 16 16"><path fill="#999" d="M5.25 7a1 1 0 0 0 0 2h5.5a1 1 0 1 0 0-2zM0 8a8 8 0 1 1 16 0A8 8 0 0 1 0 8m8-6a6 6 0 1 0 0 12A6 6 0 0 0 8 2"/></svg>Убрать из списка '+listName;
            iconTitle+= topicCount? (' '+topicCount):'';


            const myLi = document.createElement('LI');
            myLi.className = "u-menu_li myli";
            myLi.innerHTML = `<a class="u-menu_a" data-list-name="${listName}" data-tid="${topicInfo.tid}" data-url="${('https://ok.ru'+topicInfo.url)}"><div class="tico" style="color: var(--color_secondary);">${iconTitle}</div></a>`;
            elem.appendChild(myLi);


            const el = elem.querySelector(`a[data-list-name="${listName}"]`);
            if(!el)return console.error('Не удалось интегрировать меню в пост');
            el.addEventListener('click', topicsLists[listName][topicInfo.tid]? topicRemove :topicAdd);
        });
    }



    function findTopcs(){
        const elems = document.querySelectorAll(`.feed-w>.feed>.feed-header>.feed-actions-w>.feed-action>.sc-menu_w:not(.adapted),
        .hobby-topic-menu-w>.sc-menu_w:not(.adapted), #hook_Block_ShortcutMenu:not(.adapted)`);
        elems.forEach(elem => {         
            observer.observe(elem, observConfig);
            elem.classList.add('adapted');
        });
    }


    async function topicAdd(event){
        const elem = event.target.closest('a[data-list-name]');
        if(!isElementData(elem))return;

        const topicData = await getTopicData(elem.dataset.url);
        if(topicData){
            topicsLists[elem.dataset.listName][elem.dataset.tid] = topicData;
            saveListsDb();
        }
        

    }

    function isElementData(elem){
        if(!elem || !elem.dataset || (!elem.dataset.listName && !elem.dataset.wpsite) || !elem.dataset.tid || !elem.dataset.url){
            GM_notification('Ошибка добавления поста!');

            return;  
        }
        return true;
    }

    async function getTopicData(topicUrl, wpSettings){

        const elemLayerMain = document.querySelector('#mtLayer.__active') ? document.getElementById('mtLayerMain') : null;

        let res;
        try{
            res = elemLayerMain ? odTopicMediaParse(elemLayerMain) : await getTopicByUrl(topicUrl, wpSettings);
        }catch(e){
            console.error('Error:', e);
        }
        
        if(!res){
            GM_notification('Ошибка получения поста');
            return res;
        }
        res.url = topicUrl;
        return res;
    }


    function topicRemove(event){
        const elem = event.target.closest('a[data-list-name]');
        if(!elem || !elem.dataset || !elem.dataset.listName || !elem.dataset.tid){
            GM_notification('Ошибка удаления поста из списока!');
            return; 
        }
        delete topicsLists[elem.dataset.listName][elem.dataset.tid];
        saveListsDb();

    }

    function getTopicInfo(topicElem){
        if(!topicElem)return null;


        var elem = topicElem.querySelector('.feed_cnt[data-l],.groups_post[data-l]') || topicElem.closest('.groups_post[data-l]');
        if(!elem || !elem.dataset){

            if(!elem && topicElem.dataset && topicElem.dataset.l)elem = topicElem;
            else return null;
        }

        const dataL = stringToObject(elem.dataset.l);
        if(!dataL) return null;
        const res = {tid: dataL.topicId, gid: dataL.groupId, uid: dataL.ownerUserId};


        if(!res.gid && !res.uid){
            elem = topicElem.querySelector('a[rel="author"][hrefattrs*="st.friendId="]');
            if(elem){
                const mathes = elem.attributes.hrefattrs.value.match(/(\d+)/);
                if(mathes && mathes.length>1)res.uid = mathes[1];
            }
        }
        return res;

            

    }

    function stringToObject(str){
        if(!str)return null;
        try {
            const obj = JSON.parse(str);
            return obj;
        } catch (error) {
            const pairs = str.split(',');
            const obj = {};
            for (let i = 0; i < pairs.length; i += 2) {
                obj[pairs[i]] = pairs[i + 1];
            }
            return obj;
        }
    }

    async function getTopicByUrl(url, wpSettings){
        if(!url)return;
        const content  = await _sender(url);
        const parser = new DOMParser();
        const html = parser.parseFromString(content, "text/html");
        const layerMainElem = html.getElementById('mtLayerMain');
        if(!layerMainElem)return;

        return odTopicMediaParse(layerMainElem);   
    }


    async function _sender(url){
        if(!url)return;
        const urlParse = URL.parse(url);
        const resp = await fetch(url, {"credentials": "same-origin", "referrer": urlParse ? 'https://'+ urlParse.hostname : '', "method": "GET", "mode": "cors"});
        let text = await resp.text();
        return text;
    }

    function gmRequest(options){
        return new Promise((resolve, reject)=>{
            GM_xmlhttpRequest({
                method: options.method || 'GET',
                url: options.url,
                headers: options.headers || {},
                data: options.data,
                responseType: options.responseType,
                timeout: options.timeout,
                onload: resolve,
                onerror: reject,
                ontimeout: ()=>reject(new Error('Request timeout'))
            });
        });
    }
    
   


    GM_registerMenuCommand(`Редактировать списки`, ()=>{
        const lists = Object.keys(topicsLists);
        
        const tasks = [{taskName:"clear", title:"Очистить"}];
        if(lists.length<5)tasks.push({taskName:"create", title:"Создать"});
        if(lists.length>1)tasks.push({taskName:"remove", title:"Удалить"});

        let msg = 'Номер действия:\n\n'+tasks.map((item, i)=>(i+1)+' - '+item.title).join("\n");
        let item = parseInt(prompt(msg));
        if(!item || item>tasks.length)return;


        switch (tasks[item-1].taskName) {
            case 'clear':
                var selectedItem = lists.length>1 ? parseInt(prompt(getListsAsText(lists))): Number(confirm(`Очистить список "${lists[0]}"?`));
                if(!selectedItem || selectedItem>lists.length)return;
                topicsLists[lists[selectedItem-1]] = {};
                saveListsDb();
                GM_notification(`Список "${lists[selectedItem-1]}" очищен.`);
                break;
            case 'create':
                var listName = prompt('Название нового списка:').trim();
                if(listName == '' || topicsLists[listName]) return;
                topicsLists[listName] = {};
                initBtnSaveList(listName);
                saveListsDb();
                GM_notification(`Список "${listName}" создан.`);
                break;
            case 'remove':
                var selectedItem = parseInt(prompt(getListsAsText(lists)));
                if(!selectedItem || selectedItem>lists.length)return;
                var listName = lists[selectedItem-1];
                delete topicsLists[listName];
                saveListsDb();
                GM_unregisterMenuCommand(listName);
                GM_notification(`Список "${listName}" удалён.`);
                break;
            default:
                break;
        }

        
    }, {
        title:"Очистить, создать, удалить список",
        icon: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAA7klEQVQ4T5WTDRHCMAxGmQMcMAcgARwgYThAwiTgYHMAEoYCkIADkMD3es0uV7pu9C7Xn+V7TdKsWv0/akk2sjvSyumPWm8zPByHeN5o7uKas4MBEPfRPgkER8zEJ61vsrcHtNqsZeeJjLyYi9hfZLVFAIBhs+fkxKRBJP0coCjmlhJgVlwCUNSrhRlzHsPWfh9zHKYiGOSAUZM0El+rNgfgNXgiikTDAAkFc5XlLIBygJ0+PKIDTcRz8e5+FAE4AnnJ0qYySBZQaqQkgBAV8DEFqk6VyXPqVoNwUSMLLZ3+TIS+ZDytLh6wRPjj8wVBj0JhnLHEQwAAAABJRU5ErkJggg=="
    });
    
    function getListsAsText(lists){
        return lists.map((item, i)=>`${i+1} - ${item} (постов: ${Object.keys(topicsLists[item]).length})`).join("\n");
    }


    function initBtnSaveList(listName){
            GM_registerMenuCommand(listName, ()=>{
                let topics = [];
                for(let tid in topicsLists[listName]){
                    topics.push(topicsLists[listName][tid]);
                }
                if(topics.length<1)return GM_notification('Список пуст');
                //удалить в новых версиях. Адаптация полей
                topics = topicsAdapte(topics);
                
                const jsonData = JSON.stringify({"topics": topics}, null, 4);
                const blob = new Blob(['\uFEFF' + jsonData], { type: 'application/json;charset=utf-8' });
                const url = URL.createObjectURL(blob);
                GM_download({
                    url: url,
                    name: 'topics.json',
                    saveAs: true,
                    onload: function() {
                        URL.revokeObjectURL(url);

                    },
                    onerror: function(error) {
                        URL.revokeObjectURL(url);
                        console.error('Ошибка сохранения:', error);
                    }
                });

            }, {
                id:listName,
                title: `Сохранить в файл`,
                icon: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAxklEQVQ4T6WTDQ3CQAxGmQLmBBwQHCABHICDScDBJmE4mAQkgAMk8D3SI5fRHU2uSRPS+/r6s9KsKq3J8g/6vQny7tLd0CYAyYP56w+k1fvRfEyATgEezsEOrtJRqMsB5ALaytcO6KnYw+LoPnoPMOlh5wAuilE5FVoERKYodsAevBEAM8Zgoy52AICFesbiGKPYQfUI8yVSdS/neJIVO+AzzkcAmpsLqDokTrm3DUdP+ST995RpDwjtR4x9jAjzf2Mk8UfzBuRQLhEeCfwPAAAAAElFTkSuQmCC"
            });
        
    }
    Object.keys(topicsLists).forEach(listName=>initBtnSaveList(listName));
    
    function topicsAdapte(topics){
        const res = [];
        topics.forEach(topic=>{
            res.push({
                media: [],
                url: topic.url || null,
                title: topic.title
            });
            const resInd = res.length-1;
            for(const media of topic.media){
                switch (media.type) {
                    case 'text':
                        res[resInd].media.push({type: media.type, val: media.text || ''});
                        if(media.links_as_text)res[resInd].media[res[resInd].media.length-1].links_as_text = media.links_as_text;
                        break;
                    case 'link':
                        res[resInd].media.push({type: media.type, val: media.url || ''});
                        break;
                    case 'photo':
                        for (let i = 0; i < media.list.length; i++) {
                            res[resInd].media.push({type: media.type, val: media.list[i] || '', photo_id: media.ids[i], label: media.labels[i]});
                            if(media.gifs[i])res[resInd].media[res[resInd].media.length-1].mime = 'gif';
                        }
                        break;
                    default:
                        res[resInd].media.push(media);
                        break;
                }
            }
        });
        return res;
    }

    function odTopicMediaParse(elem){
        const res = {
            media: [],
            title: ''
        }

        if(!elem.matches('#mtLayerMain')){
            return null;
        }

        const mediaElems = elem.querySelectorAll('.mlr_cnt>.media-block');
        for(const m of mediaElems){

            const patterns = [
                ['[class*="media-link"]', getMediaLink],
                ['[class*="entity-link"]', getMediaLink],
                ['.media-poll', getMediaPoll],
                ['.media-text', getMediaText],
                ['.media-photos', getMediaPhoto],
                ['.media-video', getMediaVideo]
            ];
            for(let i = 0; i < patterns.length; i++){
                const p = patterns[i];
                if(m.matches(p[0])){
                    res.media.push(p[1](m));
                    break;
                }
            }    
        }

        if(res.media[0].text_tokens && res.media[0].text_tokens[0].type && res.media[0].text_tokens[0].type == 'header'){
            res.title = res.media[0].text_tokens[0].text;
        }

        return res;
    }

    function getMediaLink(elem){
        const res = {
            type: 'link',
            url: ''
        };

        const a = elem.querySelector('a.media-link_a,a.entity-link-v2_a');
        const title = a.getAttribute('title');
        if(title)res.title = title;

        const href = a.getAttribute('href');
        if(href)res.url = /^\//m.test(href) ? 'https://ok.ru'+href.split('?')[0] : href;

        return res;
    }

    function getMediaPoll(elem) {
        const res = {
            type: 'poll',
            question: elem.querySelector('.media-text_cnt').textContent || '',
            answers: [],
            images: []
        };

        const answersList = elem.querySelectorAll('li.poll_lst_li');
        for(const answer of answersList) {
            res.answers.push(answer.querySelector('.poll_n_w>.poll_n').textContent);
            const divImg = answer.querySelector('.poll_i_img');
            if(divImg){
                const style = divImg.getAttribute('style');
                if(style){
                    const match = style.match(/background-image:\s*url\((.+?)\)/);
                    if(match)res.images.push(match[1]);
                }
            }
        }  
        return res;
    }

    function getMediaPhoto(elem){
        const res = {
            type: 'photo',
            list: [],
            gif_poster_list: [],
            gifs: [],
            ids: [],
            labels: []
        };


        const imgDivs = elem.querySelectorAll('.media-photos_photo');    
        for(const div of imgDivs){
            let url, poster=null, id=null, gif=null, label = '';


            const gifDiv = div.querySelector('.gif');
            if(gifDiv){
                url = gifDiv.getAttribute('data-mp4src');
                poster = gifDiv.getAttribute('data-imagesrc');
                id = gifDiv.getAttribute('data-photoid');
                gif = gifDiv.getAttribute('data-gifsrc');
            }
    

            const img = div.querySelector('img.media-photos_img');
            if(img){	
                url = img.getAttribute('src');
                const match = (img.getAttribute('alt')||'').match(/(\d{8,})$/m);
                if(match)id = match[1];
            }
    
            if(!id){
                const mpi = div.querySelector('.media-photos_i');
                const dataL = stringToObject(mpi ? mpi.getAttribute('data-l'): '');
                id = dataL ? dataL.ti : null;
            }
    
            const imgLabel = div.querySelector('.media-photos_label');
            label = imgLabel ? imgLabel.textContent: '';
    
            if(url){
                res.list.push(url);
                res.gif_poster_list.push(poster);
                res.ids.push(id);
                res.labels.push(label);
                res.gifs.push(gif);
            }
        } 
        
        return res;
    }
    

    function getMediaVideo(elem){
        const res = {
            type: 'video',
            vid: null,
            poster: '',
            title: ''
        };

        const dataL = stringToObject(elem.getAttribute('data-l') || '');
        res.vid = dataL ? dataL.ti : null;


        const img = elem.querySelector('img.vid-card_img');
        res.poster = img ? img.getAttribute('src') : '';
       

        const a = elem.querySelector('a.video-card_n');
        res.title = a ? a.getAttribute('title') : '';
        
        return res;
    }

    function getMediaText(elem){

        const res = {
            type: 'text',
            text: '',
            text_tokens: [],
            links_as_text: []
        };
    

        const textBlock = elem.innerHTML.replace(/<img\s.+?alt="(.+?)".*?>/gi, '$1');
        const domParser = new DOMParser();
        const dcmnt = domParser.parseFromString(textBlock, "text/html");

        const mainElement = dcmnt.querySelector('.media-text_cnt_tx');
        res.text_tokens = concatTokensIsOneText(parseTextTokens(mainElement));
    

        for (let i=0; i<res.text_tokens.length; i++) { 
            const text_token = res.text_tokens[i];
            const tType = text_token.type;
    
            res.text += (tType == 'divider') ? '---' : text_token.text;
            

            if(text_token.link && res.links_as_text === undefined){
                res.text += (res.text.endsWith(' ')? '': ' ') + text_token.link;
            }
    
            if(i==res.text_tokens.length-1 || ((!res.text || res.text.endsWith("\n") || !tType || tType == 'tag') && 
                (!res.text_tokens[i+1].type || res.text_tokens[i+1].type == 'tag'))){
                continue;
            }
            
            res.text +="\n\n";
        }


        const links = mainElement.querySelectorAll('a[data-l*="linkExt"]');
        for(linkElem of links){
            res.links_as_text.push({
                text: linkElem.textContent,
                link: linkElem.nextSibling.textContent
            });

            res.text.replace(' ' + res.links_as_text[res.links_as_text.length-1].link, '');
        }

        if(res.links_as_text.length<1){
            delete res.links_as_text;
        }
    

        if(res.text_tokens.length == 1 && isTokenOneText(res.text_tokens[0])){
            delete res.text_tokens;
        }
    
        return res;
    }

    function concatTokensIsOneText(tokens){

        if(!Array.isArray(tokens))return tokens;
        for (let i=tokens.length-1; i >= 0 ; i--){
            if(i>0 && isTokenOneText(tokens[i-1]) && isTokenOneText(tokens[i])){
                tokens[i-1].text += tokens[i].text;
                tokens.splice(i, 1);
            }
        }
        return Object.values(tokens);
    }
    
    function isTokenOneText(token){
        return !token.type && !token.font_styles && !token.link;
    }

    function parseTextTokens(textBlock){
	
        const res = [];

        for (const elem of textBlock.childNodes){

            if(elem.nodeType !== Node.TEXT_NODE && !elem.matches('h1,h2,a.__hashtag,a.rev_cnt_a-in-txt,ol,ul,li,br,.media-text-token,div.media-text-token__quote,span.media-text-style,.media-hr')){
                continue;
            }
            const data = {
                text: '',
                type: null,
                font_styles: null,
                link: null,
                text_tokens: []
            };
    
            if(elem.nodeType === Node.ELEMENT_NODE){
                switch (elem.tagName.toLocaleLowerCase()){
                    case 'h1':
                        data.type = 'header';
                        break;
                    case 'h2':
                        data.type = 'sub';
                        break;
                    case 'a':
                        if(elem.matches('.__hashtag')){
                            data.type = 'tag';
    
                        }else if(elem.matches('.rev_cnt_a-in-txt')){
                            data.link = elem.getAttribute('href');
                        }
                        data.text_tokens = null;
                        break;
                    case 'ol':
                    case 'ul':
                        data.type = elem.matches('.media-text-ol') ? 'o_list' : 'u_list';

                    case 'li':
                        data.text_tokens = parseTextTokens(elem);

                        if(data.text_tokens && data.text_tokens.length === 1 && isTokenOneText(data.text_tokens[0])){
                            data.text_tokens = null;
                        }
                        break;
                    case 'br':
                        data.text += "\n";
                        data.text_tokens = null;
                        break;
                    default:

                    
                        if(elem.matches('div.media-text-token__h1')){
                            data.type = 'header';
                            
                        }else if(elem.matches('div.media-text-token__h2')){
                            data.type = 'sub';
    
                        }else if(elem.matches('div.media-text-token__quote')){
                            data.type = 'quote';
                            data.text_tokens = concatTokensIsOneText(parseTextTokens(elem));
                        }
    

                        if(elem.matches('.media-hr')){
                            data.type = 'divider';
                        }
    

                        if(elem.matches('span.media-text-style')){
                            data.font_styles = parseTextStyle(elem);
                            data.text_tokens = null;
                        }
                        break;
                }
    
            }else if(elem.nodeType === Node.TEXT_NODE){
                data.text_tokens = null;
            }
            
            data.text += data.type != 'divider' ? getInnerText(elem): '';
            res.push({});


            for(const key of Object.keys(data)) {
                if(data[key] !== null)res[res.length-1][key] = data[key];
            }
        }
        
        return res;
    }

    function parseTextStyle(elem){

        const res = [];
        [
            ['.__b', 'B'],
            ['.__i', 'I'],
            ['.__u', 'U'],
            ['.__s', 'S'],
            ['.__m', 'M']    
        ].forEach(p=>{
            if(elem.matches(p[0]) && (p[0] !== '.__i' || !elem.parentNode.matches('.media-text-token__quote')))
                res.push(p[1]);
        });

        return res.length>0 ? res: null;
    }

    function getInnerText(node){
        let res = '';
        const children = node.childNodes;
        if(children.length<1) return node.nodeValue !== null ? node.nodeValue : '';
    
        for(const child of children){
            if(child.nodeType === Node.TEXT_NODE){
                res += child.nodeValue;
            }else if(child.nodeType === Node.ELEMENT_NODE){

                if(child.matches('[class*="hidden"]'))continue;
                const tegName = child.tagName.toLocaleLowerCase();
                if(tegName == 'br'){
                    res += "\n";
                }else{
                    res+= getInnerText(child);
                    if(tegName == 'li')res += "\n";

                }
            }
        }
        return res;
    }

})();
