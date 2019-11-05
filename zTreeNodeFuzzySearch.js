/*
 * zTree节点模糊搜索方法
 * Created by PhpStorm.
 * User: hanjinxiang
 * Date: 2019/11/05
 * Time: 17:49
 * note:
 *      当前方法经过优化在处理5000多节点时性能提升明显 ,少量结果平均100毫秒内完成，结果较多时（数百）在1秒左右， 尚未测过更多节点下的性格表现，
 *      经过简单分析目前耗时最多环节为隐藏节点环节（_showPathNodes 方法内 zTreeObj.hideNodes(value[childrenKey]);）
 *      结合具体场景仍有较大优化空间
 *      节点高亮通过对节点值添加css实现，注意修改节点前将待修改值还原或单独弹出编辑框，以免将html代码保存到节点名称中
 *
 * example1  主动触发:
 *    zTreeNodesFuzzySearch().search(zTreeId,keyWord,aliasNameKey)
 * example2  监听输入框值改变事件触发:
 *    zTreeNodesFuzzySearch().changeEventSearch(zTreeId,elementId,aliasNameKey)
 * example3  监听输入框值输入事件触发:
 *    zTreeNodesFuzzySearch().keyDownEventSearch(zTreeId,elementId,aliasNameKey)
 * example4  主动清除搜索对树结构的影响:
 *    zTreeNodesFuzzySearch().clearSearch(zTreeId,aliasNameKey)
 *
 */
const zTreeNodesFuzzySearch = () => {
    /**
     * 节点搜索方法
     * @param zTreeId 树结构id
     * @param keyWord 节点关键字
     * @param aliasNameKey 别名字段 默认别名为 __zTreeAliasName
     * @param isHighLight 是否高亮搜索关键字  默认高亮
     * @param isExpand   输入空字符串时展开所有节点还是折叠所有节点 默认折叠
     * @param searchHighLightKey   搜索时对需要高亮的节点会添加高亮标识 用于下次调用时清除高亮 默认标识为 __searchHighLight
     */
    const search = (
        zTreeId,
        keyWord,
        aliasNameKey = '__zTreeAliasName',
        isHighLight = true,
        isExpand    = false,
        childrenKey = 'children',
        searchHighLightKey = '__searchHighLight'
    ) => {
        let startTime = new Date().getTime();
        //获取树对象
        let zTreeObj = $.fn.zTree.getZTreeObj(zTreeId);
        if (!zTreeObj) {
            console.log('zTreeObj:', zTreeObj);
            layer.msg('获取树对象失败');
            return false;
        }

        // 获取name属性Key
        let nameKey = zTreeObj.setting.data.key.name;

        // 除直接输入false的情况 ， 都默认高亮
        isHighLight = isHighLight === false ? false : true;
        isExpand = isExpand ? true : false;

        // 允许在节点名称中使用html,用于处理高亮
        zTreeObj.setting.view.nameIsHTML = isHighLight;

        // 将所有节点设置为显示状态
        let nodes = zTreeObj.getNodes();
        // 清除上次搜索的节点高亮
        _clearHighNode(zTreeObj, nameKey, aliasNameKey, searchHighLightKey);

        // 如果搜索的是空字符串 直接返回 并按设置折叠或展开所有节点
        if (keyWord == '') {
            _showAllHideNodes(zTreeObj, nodes);
            zTreeObj.expandAll(isExpand);
            return false;
        }

        // 获取搜索结果
        let searchResNodes = zTreeObj.getNodesByParamFuzzy(aliasNameKey, keyWord);

        if (searchResNodes.length == 0) {
            layer.msg('没有查询到结果');
            return false;
        }

        // 隐藏所有根节点
        zTreeObj.hideNodes(nodes);

        // 处理搜索结果
        _handleSearchResult(zTreeObj, searchResNodes, keyWord, isHighLight, nameKey, childrenKey, searchHighLightKey);
        let endTime = new Date().getTime();
        console.log('搜索全程用时：', endTime - startTime);
    };

    /**
     * 值改变事件触发搜索
     * @param zTreeId 树结构id  不需要#
     * @param searchElementId  搜索输入框id 需要#号
     * @param aliasNameKey
     * @param isHighLight
     * @param isExpand
     * @param searchHighLight
     */
    const changeEventSearch = (
        zTreeId,
        searchElementId,
        aliasNameKey = '__zTreeAliasName',
        isHighLight = true,
        isExpand = false,
        childrenKey = 'children',
        searchHighLight = '__searchHighLight'
    ) => {
        $(searchElementId).change(function () {
            let _keywords = $(this).val();
            //节点搜索
            search(zTreeId, _keywords, aliasNameKey, isHighLight, isExpand, childrenKey, searchHighLight);
        });
    }

    /**
     * 按键输入事件触发搜索
     * @param zTreeId
     * @param searchElementId
     * @param aliasNameKey
     * @param isHighLight
     * @param isExpand
     * @param searchHighLight
     */
    const keyDownEventSearch = (
        zTreeId,
        searchElementId,
        aliasNameKey = '__zTreeAliasName',
        isHighLight = true,
        isExpand = false,
        childrenKey = 'children',
        searchHighLight = '__searchHighLight'
    ) => {
        $(searchElementId).bind('input propertychange', function () {
            let _keywords = $(this).val();

            let timeoutId = setTimeout(() => {
                if (lastKeyword === _keywords) {
                    return;
                }
                search(zTreeId, _keywords, aliasNameKey, isHighLight, isExpand, childrenKey, searchHighLight);
                $(searchElementId).focus();
                let lastKeyword = _keywords;
            }, 500);
            //节点搜索

        });
    }

    /**
     * 处理搜索结果 添加高亮 显示路径节点 隐藏无关节点
     * @param zTreeObj
     * @param nodes
     * @param keyWord
     * @param isHighLight
     * @param nameKey
     * @returns {boolean}
     * @private
     */
    const _handleSearchResult = (
        zTreeObj, nodes, keyWord, isHighLight, nameKey = 'name', childrenKey = "children", searchHighLight = '__searchHighLight'
    ) => {
        let startTime = new Date().getTime();
        if (!nodes || nodes.length <= 0) {
            console.log('搜索结果为空');
            return false;
        }
        // 创建最终显示的结果集
        let showNodes = {};

        // 遍历搜索结果  添加样式并设置路径父节点的显示
        $.each(nodes, (index, node) => {
            // 节点替换添加样式实现高亮，并保存原节点名称
            _highLightNode(zTreeObj, node, keyWord, isHighLight, nameKey, searchHighLight);
            // 显示节点路径上的所有节点
            showNodes = _handlePathNodes(node, showNodes);
        });
        let pathTime = new Date().getTime();
        console.log('处理搜索结果用时：', pathTime - startTime);
        // 显示路径节点
        _showPathNodes(zTreeObj, showNodes, childrenKey);
        let endTime = new Date().getTime();
        console.log('显示路径用时：', endTime - pathTime);
    };

    /**
     * 处理需要高亮的节点
     * @param zTreeObj
     * @param node
     * @param keyWord
     * @param isHighLight
     * @param nameKey
     * @param searchHighLight
     * @returns {boolean}
     * @private
     */
    const _highLightNode = (
        zTreeObj, node, keyWord, isHighLight, nameKey = 'name', searchHighLight = '__searchHighLight'
    ) => {
        // let startTime = new Date().getTime();

        if (!node[nameKey]) {
            return false;
        }

        if (!isHighLight) {
            return true;
        }
        // 取消高亮
        node.highlight = false;
        // 更新节点前让上述修改生效
        // 为节点添加高亮标识
        node[searchHighLight] = true;
        let regx = new RegExp(keyWord, 'gi');
        node[nameKey] = node[nameKey].replace(regx, (matchStr) => {
            // TODO : 需要修改高亮配色 修改此处颜色即可
            return '<span style="color: whitesmoke;background-color: #00a7d0;">' + matchStr + '</span>';
        });
        zTreeObj.updateNode(node);
        // let endTime = new Date().getTime();
        // console.log('处理一个节点的高亮耗时：', endTime - startTime);
    }

    /**
     * 处理搜索结果的路径节点 并返回结果集
     * 处理思路为 将同级所有需要显示的节点保存
     * @param node
     * @param showNodes
     * @returns {*}
     * @private
     */
    const _handlePathNodes = (node, showNodes) => {
        // let startTime = new Date().getTime();
        let path = node.getPath();
        path.map((item, index) => {
            // console.log('item',item);
            if (showNodes[item.level] == undefined) {
                showNodes[item.level] = {};
            }
            showNodes[item.level][item.id] = item;
        });
        // let endTime = new Date().getTime();
        // console.log('handlePathNodes', endTime - startTime);
        return showNodes;
    }

    /**
     * 显示路径节点数据
     * @param showNodes
     * @private
     */
    const _showPathNodes = (zTreeObj, showNodes, childrenKey) => {
        let runTime = new Date().getTime();
        let runTime2 = new Date().getTime();
        let arr = [];
        // 第一次遍历 遍历所有层级
        $.each(showNodes, (i, item) => {
            runTime = new Date().getTime();
            // 显示当前节点
            console.log('item', item);
            // 第二次遍历 遍历该层级下所有需处理节点
            $.each(item, (index, value) => {
                runTime2 = new Date().getTime();

                arr.push(value);
                // 如果存在子节点，则隐藏所有子节点
                if (value[childrenKey] != undefined) {
                    // 搜索结果的路径全部展开
                    zTreeObj.expandNode(value, true);
                    zTreeObj.hideNodes(value[childrenKey]);
                }
                console.log('处理第' + i + '个层级中第' + index + '个元素用时：', new Date().getTime() - runTime2);

            });
            console.log('处理第' + i + '个层级用时：', new Date().getTime() - runTime);
        });
        runTime = new Date().getTime();
        zTreeObj.showNodes(arr);
        console.log('处理层级完成后显示节点用时：', new Date().getTime() - runTime);

    }

    // 简单json处理方法
    const _simpleData = (data, aliasNameKey, nameKey) => {
        for (let i in data) {
            data[i][aliasNameKey] = data[i][nameKey];
        }
        return data;
    }

    // 标准json处理方法
    const _standData = (data, aliasNameKey, nameKey, childrenKey) => {
        for (let i in data) {
            data[i][aliasNameKey] = data[i][nameKey];
            if (data[i][childrenKey] != undefined) {
                data[i][childrenKey] = _standData(data[i][childrenKey], aliasNameKey, nameKey, childrenKey)
            }
        }
        return data;
    }

    /**
     * 处理zTree Data 标准json 为name添加别名
     * @param data
     * @param type  数据格式 对应初始化zTree使用的两种数据结构 默认为标准json 传入'simple' 表示使用简单json
     * @param aliasNameKey 别名字段  默认为 __zTreeAliasName
     * @param nameKey 默认为name
     * @param childrenKey 标准json的子节点字段 默认为children
     */
    const handleTreeDate = (data, type, aliasNameKey, nameKey, childrenKey) => {
        aliasNameKey = aliasNameKey ? aliasNameKey : '__zTreeAliasName';
        nameKey = nameKey ? nameKey : 'name';
        if (type == 'simple') {
            return _simpleData(data, aliasNameKey, nameKey);
        }
        childrenKey = childrenKey ? childrenKey : 'children';
        return _standData(data, aliasNameKey, nameKey, childrenKey);
    };

    /**
     * 显示所有隐藏节点
     * @param zTreeObj
     * @param nodes
     * @private
     */
    const _showAllHideNodes = (zTreeObj, nodes, childrenKey = 'children') => {
        zTreeObj.showNodes(nodes);
        $.each(nodes, (i, node) => {
            if (node[childrenKey] != undefined) {
                _showAllHideNodes(zTreeObj, node[childrenKey]);
            }
        })

    }

    /**
     * 清除节点高亮
     * @param zTreeObj
     */
    const _clearHighNode = (zTreeObj, nameKey, aliasNameKey, searchHighLightKey) => {
        zTreeObj.getNodesByFilter((node) => {
            if (node && node[searchHighLightKey]) {
                console.log(searchHighLightKey);
                console.log(aliasNameKey);
                console.log(node[aliasNameKey]);
                node[nameKey] = node[aliasNameKey];
                delete node[searchHighLightKey];
                zTreeObj.updateNode(node);
            }
            return false;
        });
    }

    /**
     * 清除搜索对树结构产生的高亮,节点隐藏的影响  （主动调用）
     * 一般情况不需要主动调用，每次搜索前会先清除关键字高亮 搜索空关键字也可消除影响
     * @param zTreeId
     * @param aliasNameKey
     */
    const clearSearch = (zTreeId, aliasNameKey = '__zTreeAliasName', searchHighLightKey = '__searchHighLight') => {
        let zTreeObj = $.fn.zTree.getZTreeObj(zTreeId);
        let nameKey = zTreeObj.setting.data.key.name;
        let nodes = zTreeObj.getNodes();
        // console.log(nodes);
        _showAllHideNodes(zTreeObj, nodes);
        zTreeObj.expandAll(false);
        _clearHighNode(zTreeObj, nameKey, aliasNameKey, searchHighLightKey);
    }

    /**
     * 对外接口方法
     */
    return {
        search,
        changeEventSearch,
        keyDownEventSearch,
        clearSearch,
        handleTreeDate
    }
}
