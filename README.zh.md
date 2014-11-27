# Best Route Table [![NPM version](https://badge.fury.io/js/bestroutetb.png)](http://badge.fury.io/js/bestroutetb)

受[chnroutes][chnroutes]启发。

这一项目旨在生成一个最小的路由表，
可以满足将给定国家或子网
的IP地址路由到
指定网关（默认或 VPN）。

整体而言，生成的路由表会比
chnroutes 的小 70%.


## 目标

我开始了这一项目源于
*chnroutes* 生成的路由表放不进我的路由器。

由于路由表需要 4 分钟加载时间，我不能将它放到
OpenVPN 的配置文件中。与此同时我的服务提供商
推送了 `ping-reset 60` 指令到客户端，将
OpenVPN 连接在路由表加载完成前重置。

因此我决定将路由表最小化。


## 效果如何？

举例来说，生成将全部中国 IP 路由到默认网关，
同时将美国、英国、日本和香港管辖的 IP 路由到 VPN
网关只需要 1546 条路由规则（基于 11/21/2014 的数据），
而 *chnroutes* 需要 4953 条路由规则。

规则数量几乎 **减少 70%**。而如果只保证美国地址路由到 VPN 网关，
路由表只包含 **105 条指令**，这仅仅是原始大小的
2%。

Linux 系统使用 [TRASH][trash] 结构存储
路由表，每个查询需要访问
内存 O(loglog _n_) 次。使用 *bestroutetb* 取代 *chnroutes*，
每次可以减少内存访问访问 0.01 次。
这一解决方案将路由表至少大小减少了 70%，
基于 TRASH 结构使用了一个紧凑的
哈希实现。因此这一解决方案非常适合
只有少量空闲内存的路由器。


## 如何工作

与 *chnroutes* 生成一个将
全部中国子网路由到 ISP 网关的，并将其它地址路由到 VPN 网关路由表不同。
本项目将 IP 地址分成三组。 第一组被保证
路由到 ISP 网关，第二组被保证
路由到 VPN 网关。与此同时，最后一组将会被动态的分配到
其中一个网关，使产生的
路由表最小。

为了达到这一目的，该项目使用了动态规划
算法来查找最优的路由表。

我们可以证明，生成结果是在给定条件下
的最小路由表。

[查看算法详情][Blog]。


## 如何使用

### 安装

这一项目需要 [node.js][nodejs] 运行。

如果您正在使用 OS X 可以通过 homebrew 安装 node.js.

    $ brew install nodejs

从 NPM 安装，当做命令行程序：

    $ npm install -g bestroutetb

从 NPM 安装，用于编程使用：

    $ npm install bestroutetb

从 Git 安装：

    $ git clone https://github.com/ashi009/bestroutetb.git
    $ cd bestroutetb
    $ npm link .

### 使用

    $ bestroutetb [选项]

### 选项

#### 路由

    --route.net=<条件>
    --route.vpn=<条件>

应该被路由到 ISP 或 VPN 网关的子网。

**条件** 是一个包括双字母国家名（如 CN）、子网（如
`8.0.0.0/8`）以及主机地址（如 `123.123.123.123`）并用逗号（`,`）连接的列表。

_注:_ 您也可以使用多个 `--route.*` 参数构建这一列表。

#### 输出格式档案

    -p <档案>, --profile=<档案>

内建格式档案包括 `custom`、`iproute`、`json`及`openvpn`。

您也可以指定一个 javascript 文件作为格式档案（`-p openwrt.js`）。

#### 输出

    -o <路径>, --output=<路径>

输出文件路径。

_注:_ 一些输出格式档案会生成多个文件。这种情况下，您需要
指定输出目录（如 `-o output/`），与此同时您可以规定输出文件的
前缀和想要使用的扩展名（如 `-o output/ip-.sh`）。

    -f, --force

覆盖已经存在的文件。

#### 报告

_NOT implemented_

    -r <路径>, --report=<路径>

生成报告并保存到给定路径。

#### 输出格式

_注:_ 所有的字符串在输出时都不会添加换行符（`\n`）。
因此，请您在定义的时候自行添加。如 zsh、bash 和一些
其他的 Shell 程序，您可以使用 `$'line\n'` 来定义包括转义字符的字符串。

    --header=<字符串>
    --footer=<字符串>

输出文件的头和尾。

    --rule-format=<字符串>

用于格式化规则的字符串。

您可以在字符串中使用 `%prefix`、`%mask`、`%length`、`%gateway` 和 `%gw`。

- `%prefix` 是子网的前缀（如 `14.0.0.0`）。
- `%mask` 是子网的掩码（如 `255.0.0.0`）。
- `%length` 是子网掩码的长度（如 `8`）。
- `%gateway` 是子网的路由目标网关(如 `net` 和 `vpn`）。
- `%gw` 是自定义的网关名称（如 `pppoe` 和 `tun0`），该字段可以通过
  `--gateway.net` 和 `--gateway.vpn` 设置。

<!-- -->

    --gateway.net=<字符串>
    --gateway.vpn=<字符串>

定义用于规则格式中替代 `%gw` 的内容。

    --[no-]default-gateway

设置是否输出默认路由（`0.0.0.0/0`）的规则，默认输出。

    --[no-]group-gateway

设置是否按网关分组输出。

    --group-header=<字符串>
    --group-footer=<字符串>

每组输出的头和尾。

您可以在字符串中使用 `%name`。

- `%name` 是自定义的组名称（如 `wan` 和 `vpn`），该字段可以通过
  `--group-name.net` 和 `--group-name.vpn` 设置。

<!-- -->

    --group-name.net=<字符串>
    --group-name.vpn=<字符串>

定义用于组头和尾中替代 `%name` 的内容。

#### 更新

    --[no-]update

强制更新 IP 委托数据，或强制使用陈旧数据。

#### 配置文件

    -c <路径>, --config=<路径>

配置文件的路径。

#### 日志

    -v, --verbose

设置详细输出等级。使用 `-vvvv` 调试。

    -s, --silent

安静模式。禁止一切输出。

#### 帮助

    -h, --help

显示帮助。

#### 版本

    -V, --version

显示版本号。

### 示例

    $ bestroutetb --route.vpn=us -p json -o routes.json

[chnroutes]: https://github.com/fivesheep/chnroutes
[trash]: http://www.nada.kth.se/~snilsson/publications/TRASH/trash.pdf
[blog]: http://ashi009.tumblr.com/post/36581070478/vpn
[nodejs]: http://nodejs.org
[wget]: http://www.gnu.org/software/wget/
