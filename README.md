# zTreeNodesFuzzySearch
zTree 树结构节点模糊搜索方法
```
/*
 * zTree节点模糊搜索方法
 * Created by PhpStorm.
 * User: werty.cn
 * Date: 2019/11/05
 * Time: 17:49
 * note:
 *      当前方法经过优化在处理5000多节点时性能提升明显 ,少量结果平均100毫秒内完成，结果较多时（数百）在1秒左右， 尚未测过更多节点下的性格表现，
 *      经过简单分析目前耗时最多环节为隐藏节点环节（_showPathNodes 方法内 zTreeObj.hideNodes(value[childrenKey]);）
 *      结合具体场景仍有较大优化空间 如连续搜索时大部分节点已隐藏，可以自己实现批量隐藏节点方法，替换hideNodes方法
 *      节点高亮通过对节点值添加html代码实现，注意修改节点前将待修改值还原或单独弹出编辑框，以免将html代码保存到节点名称中
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
```

参考资料：
https://github.com/bigablecat/zTreeFuzzySearch
基于参考资料提供方法进行了性能优化，基于ES6重新实现，并修复原方法中存在的一些问题，如节点较多时搜索次数越多搜索越慢。
