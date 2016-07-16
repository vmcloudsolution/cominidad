openerp.pos_loyalty = function(instance){

    var module   = instance.point_of_sale;
    var round_pr = instance.web.round_precision
    var QWeb     = instance.web.qweb;

    var models = module.PosModel.prototype.models;
    for (var i = 0; i < models.length; i++) {
        var model = models[i];
        if (model.model === 'res.partner') {
            model.fields.push('loyalty_points');
        } else if (model.model === 'product.product') {
            // load loyalty after products
            models.push(i+1,0,{
                model: 'loyalty.program',
                condition: function(self){ return !!self.config.loyalty_id[0]; },
                fields: ['name','pp_currency','pp_product','pp_order','rounding'],
                domain: function(self){ return [['id','=',self.config.loyalty_id[0]]]; },
                loaded: function(self,loyaltyes){ if(loyaltyes[0]) { self.loyalty = loyaltyes[0]; } else { self.loyalty = null; }
                },
            },{
                model: 'loyalty.rule',
                condition: function(self){ return !!self.loyalty; },
                fields: ['name','type','product_id','category_id','cumulative','pp_product','pp_currency'],
                domain: function(self){ if(self.loyalty != null) { return [['loyalty_program_id','=',self.loyalty.id]]; } return null; },
                loaded: function(self,rules){ 
                    if(self.loyalty != null) {
                        self.loyalty.rules = rules; 
                        self.loyalty.rules_by_product_id = {};
                        self.loyalty.rules_by_category_id = {};
    
                        for (var i = 0; i < rules.length; i++){
                            var rule = rules[i];
                            if (rule.type === 'product') {
                                if (!self.loyalty.rules_by_product_id[rule.product_id[0]]) {
                                    self.loyalty.rules_by_product_id[rule.product_id[0]] = [rule];
                                } else if (rule.cumulative) {
                                    self.loyalty.rules_by_product_id[rule.product_id[0]].unshift(rule);
                                } else {
                                    self.loyalty.rules_by_product_id[rule.product_id[0]].push(rule);
                                }
                            } else if (rule.type === 'category') {
                                var category = self.db.get_category_by_id(rule.category_id[0]);
                                if (!self.loyalty.rules_by_category_id[category.id]) {
                                    self.loyalty.rules_by_category_id[category.id] = [rule];
                                } else if (rule.cumulative) {
                                    self.loyalty.rules_by_category_id[category.id].unshift(rule);
                                } else {
                                    self.loyalty.rules_by_category_id[category.id].push(rule);
                                }
                            }
                        }
                    }
                },
            },{
                model: 'loyalty.reward',
                condition: function(self){ return !!self.loyalty; },
                fields: ['name','type','minimum_points','gift_product_id','point_cost','discount_product_id','discount','point_value','point_product_id'],
                domain: function(self){ if(self.loyalty != null) { return [['loyalty_program_id','=',self.loyalty.id]]; } else { return null; } },
                loaded: function(self,rewards){
                    if(self.loyalty != null) {
                        self.loyalty.rewards = rewards; 
                        self.loyalty.rewards_by_id = {};
                        for (var i = 0; i < rewards.length;i++) {
                            self.loyalty.rewards_by_id[rewards[i].id] = rewards[i];
                        }
                    }
                },
            });
        }
    }

    var _super_orderline = module.Orderline;
    module.Orderline = module.Orderline.extend({
        get_reward: function(){
            return this.pos.loyalty.rewards_by_id[this.reward_id];
        },
        set_reward: function(reward){
            this.reward_id = reward.id;
        },
        export_as_JSON: function(){
            var json = _super_orderline.prototype.export_as_JSON.apply(this,arguments);
            json.reward_id = this.reward_id;
            return json;
        },
        init_from_JSON: function(json){
            _super_orderline.prototype.init_from_JSON.apply(this,arguments);
            this.reward_id = json.reward_id;
        },
    });

    var _super = module.Order;
    module.Order = module.Order.extend({

/* ---- Order Lines --- */
        add_orderline: function(line){
            if(line.order){
                line.order.remove_orderline(line);
            }
            line.order = this;
            this.orderlines.add(line);
            this.select_orderline(this.get_last_orderline());
        },
        get_orderline: function(id){
            var orderlines = this.orderlines.models;
            for(var i = 0; i < orderlines.length; i++){
                if(orderlines[i].id === id){
                    return orderlines[i];
                }
            }
            return null;
        },
        get_orderlines: function(){
            this.orderlines = this.attributes.orderLines;
            return this.orderlines.models;
        },
        get_last_orderline: function(){
            return this.orderlines.at(this.orderlines.length -1);
        },
        remove_orderline: function( line ){
            this.orderlines.remove(line);
            this.select_orderline(this.get_last_orderline());
        },
        add_product: function(product, options){
            options = options || {};
            var attr = JSON.parse(JSON.stringify(product));
            attr.pos = this.pos;
            attr.order = this;
            var line = new module.Orderline({}, {pos: this.pos, order: this, product: product});

            if(options.quantity !== undefined){
                line.set_quantity(options.quantity);
            }
            if(options.price !== undefined){
                line.set_unit_price(options.price);
            }
            if(options.discount !== undefined){
                line.set_discount(options.discount);
            }

            if(options.extras !== undefined){
                for (var prop in options.extras) { 
                    line[prop] = options.extras[prop];
                }
            }

            var last_orderline = this.get_last_orderline();
            if( last_orderline && last_orderline.can_be_merged_with(line) && options.merge !== false){
                last_orderline.merge(line);
            }else{
                this.orderlines.add(line);
            }
            this.select_orderline(this.get_last_orderline());
        },
        get_selected_orderline: function(){
            return this.selected_orderline;
        },
        select_orderline: function(line){
            if(line){
                if(line !== this.selected_orderline){
                    if(this.selected_orderline){
                        this.selected_orderline.set_selected(false);
                    }
                    this.selected_orderline = line;
                    this.selected_orderline.set_selected(true);
                }
            }else{
                this.selected_orderline = undefined;
            }
        },
        deselect_orderline: function(){
            if(this.selected_orderline){
                this.selected_orderline.set_selected(false);
                this.selected_orderline = undefined;
            }
        },

        add_paymentline: function(cashregister) {
            var newPaymentline = new module.Paymentline({},{cashregister:cashregister, pos: this.pos});
            if(cashregister.journal.type !== 'cash' || this.pos.config.iface_precompute_cash){
                newPaymentline.set_amount( Math.max(this.get_due(),0) );
            }
            this.attributes.paymentLines.add(newPaymentline);
            this.select_paymentline(newPaymentline);

        },
        get_paymentlines: function(){
            return this.attributes.paymentLines.models;
        },
        remove_paymentline: function(line){
            if(this.selected_paymentline === line){
                this.select_paymentline(undefined);
            }
            this.attributes.paymentLines.remove(line);
        },
        clean_empty_paymentlines: function() {
            var lines = this.attributes.paymentLines.models;
            var empty = [];
            for ( var i = 0; i < lines.length; i++) {
                if (!lines[i].get_amount()) {
                    empty.push(lines[i]);
                }
            }
            for ( var i = 0; i < empty.length; i++) {
                this.remove_paymentline(empty[i]);
            }
        },


        /* The total of points won, excluding the points spent on rewards */
        get_won_points: function(){
            if (!this.pos.loyalty || !this.get_client()) {
                return 0;
            }
            
            var orderLines = this.get_orderlines();
            var rounding   = this.pos.loyalty.rounding;
            
            var product_sold = 0;
            var total_sold   = 0;
            var total_points = 0;

            for (var i = 0; i < orderLines.length; i++) {
                var line = orderLines[i];
                var product = line.get_product();
                var rules  = this.pos.loyalty.rules_by_product_id[product.id] || [];
                var overriden = false;

                if (line.get_reward()) {  // Reward products are ignored
                    continue;
                }
                for (var j = 0; j < rules.length; j++) {
                    var rule = rules[j];
                    total_points += round_pr(line.get_quantity() * rule.pp_product, rounding);
                    total_points += round_pr(line.get_price_with_tax() * rule.pp_currency, rounding);
                    // if affected by a non cumulative rule, skip the others. (non cumulative rules are put
                    // at the beginning of the list when they are loaded )
                    if (!rule.cumulative) { 
                        overriden = true;
                        break;
                    }
                }
                // Test the category rules
                if ( product.pos_categ_id ) {
                    var category = this.pos.db.get_category_by_id(product.pos_categ_id[0]);
                    while (category && !overriden) {
                        var rules = this.pos.loyalty.rules_by_category_id[category.id] || [];
                        for (var j = 0; j < rules.length; j++) {
                            var rule = rules[j];
                            total_points += round_pr(line.get_quantity() * rule.pp_product, rounding);
                            total_points += round_pr(line.get_price_with_tax() * rule.pp_currency, rounding);
                            if (!rule.cumulative) {
                                overriden = true;
                                break;
                            }
                        }
                        var _category = category;
                        category = this.pos.db.get_category_by_id(this.pos.db.get_category_parent_id(category.id));
                        if (_category === category) {
                            break;
                        }
                    }
                }

                if (!overriden) {
                    product_sold += line.get_quantity();
                    total_sold   += line.get_price_with_tax();
                }
            }

            total_points += round_pr( total_sold * this.pos.loyalty.pp_currency, rounding );
            total_points += round_pr( product_sold * this.pos.loyalty.pp_product, rounding );
            total_points += round_pr( this.pos.loyalty.pp_order, rounding );

            return total_points;
        },

        /* The total number of points spent on rewards */
        get_spent_points: function() {
            if (!this.pos.loyalty || !this.get_client()) {
                return 0;
            } else {
                var lines    = this.get_orderlines();
                var rounding = this.pos.loyalty.rounding;
                var points   = 0;

                for (var i = 0; i < lines.length; i++) {
                    var line = lines[i];
                    var reward = line.get_reward();
                    if (reward) {
                        if (reward.type === 'gift') {
                            points += round_pr(line.get_quantity() * reward.point_cost, rounding);
                        } else if (reward.type === 'discount') {
                            points += round_pr(-line.get_display_price() * reward.point_cost, rounding);
                        } else if (reward.type === 'resale') {
                            points += (-line.get_quantity());
                        }
                    }
                }

                return points;
            }
        },

        /* The total number of points lost or won after the order is validated */
        get_new_points: function() {
            if (!this.pos.loyalty || !this.get_client()) {
                return 0;
            } else { 
                return round_pr(this.get_won_points() - this.get_spent_points(), this.pos.loyalty.rounding);
            }
        },

        /* The total number of points that the customer will have after this order is validated */
        get_new_total_points: function() {
            if (!this.pos.loyalty || !this.get_client()) {
                return 0;
            } else { 
                return round_pr(this.get_client().loyalty_points + this.get_new_points(), this.pos.loyalty.rounding);
            }
        },

        /* The number of loyalty points currently owned by the customer */
        get_current_points: function(){
            return this.get_client() ? this.get_client().loyalty_points : 0;
        },

        /* The total number of points spendable on rewards */
        get_spendable_points: function(){
            if (!this.pos.loyalty || !this.get_client()) {
                return 0;
            } else {
                return round_pr(this.get_client().loyalty_points - this.get_spent_points(), this.pos.loyalty.rounding);
            }
        },

        /* The list of rewards that the current customer can get */
        get_available_rewards: function(){
            var client = this.get_client();
            if (!client) {
                return [];
            } 

            var rewards = [];
            for (var i = 0; i < this.pos.loyalty.rewards.length; i++) {
                var reward = this.pos.loyalty.rewards[i];
                if (reward.minimum_points > this.get_spendable_points()) {
                    continue;
                } else if(reward.type === 'gift' && reward.point_cost > this.get_spendable_points()) {
                    continue;
                } 
                rewards.push(reward);
            }
            return rewards;
        },
        
        get_total_with_tax: function() {
            return this.orderlines.reduce((function(sum, orderLine) {
                return sum + orderLine.get_price_with_tax();
            }), 0);
        },
        
        apply_reward: function(reward){
            var client = this.get_client();
            if (!client) {
                return;
            } else if (reward.type === 'gift') {
                var product = this.pos.db.get_product_by_id(reward.gift_product_id[0]);
                if (!product) {
                    this.pos.pos_widget.screen_selector.show_popup('error',{
                        'message':'Configuration Error',
                        'comment':'The product associated with the reward "'+reward.name+'" could not be found. Make sure it is available for sale in the point of sale.',
                    });
                    return;
                }

                var line = this.add_product(product, { 
                    price: 0, 
                    quantity: 1, 
                    merge: false, 
                    extras: { reward_id: reward.id },
                });

            } else if (reward.type === 'discount') {
                
                var lrounding = this.pos.loyalty.rounding;
                var crounding = this.pos.currency.rounding;
                var spendable = this.get_spendable_points();
                var order_total = this.get_total_with_tax();
                var discount    = round_pr(order_total * reward.discount,crounding);

                if ( round_pr(discount * reward.point_cost,lrounding) > spendable ) { 
                    discount = round_pr(Math.floor( spendable / reward.point_cost ), crounding);
                }

                var product   = this.pos.db.get_product_by_id(reward.discount_product_id[0]);
                if (!product) { //FIXME, move this as a server side constraint
                    this.pos.pos_widget.screen_selector.show_popup('error',{
                        'message':'Configuration Error',
                        'comment':'The product associated with the reward "'+reward.name+'" could not be found. Make sure it is available for sale in the point of sale.',
                    });
                    return;
                }

                var line = this.add_product(product, { 
                    price: -discount, 
                    quantity: 1, 
                    merge: false,
                    extras: { reward_id: reward.id },
                });

            } else if (reward.type === 'resale') {

                var lrounding = this.pos.loyalty.rounding;
                var crounding = this.pos.currency.rounding;
                var spendable = this.get_spendable_points();
                var order_total = this.get_total_with_tax();
                var product = this.pos.db.get_product_by_id(reward.point_product_id[0]);

                if (!product) { //FIXME, move this as a server side constraint
                    this.pos.pos_widget.screen_selector.show_popup('error',{
                        'message':'Configuration Error',
                        'comment':'The product associated with the reward "'+reward.name+'" could not be found. Make sure it is available for sale in the point of sale.',
                    });
                    return;
                }

                if ( round_pr( spendable * product.price, crounding ) > order_total ) {
                    spendable = round_pr( Math.floor(order_total / product.price), lrounding);
                }

                if ( spendable < 0.00001 ) {
                    return;
                }
                var line = this.add_product(product, {
                    quantity: -spendable,
                    merge: false,
                    extras: { reward_id: reward.id },
                });
            }
        },
            
        validate: function(){
            var client = this.get_client();
            if ( client ) {
                client.loyalty_points = this.get_new_total_points();
            }
            _super.prototype.validate.apply(this,arguments);
        },
        export_for_printing: function(){
            var json = _super.prototype.export_for_printing.apply(this,arguments);
            if (this.pos.loyalty && this.get_client()) {
                json.loyalty = {
                    rounding:     this.pos.loyalty.rounding || 1,
                    name:         this.pos.loyalty.name,
                    client:       this.get_client().name,
                    points_won  : this.get_won_points(),
                    points_spent: this.get_spent_points(),
                    points_total: this.get_new_total_points(), 
                };
            }
            return json;
        },
        export_as_JSON: function(){
            var json = _super.prototype.export_as_JSON.apply(this,arguments);
            json.loyalty_points = this.get_new_points();
            return json;
        },
    });

    module.PosWidget.include({
        loyalty_reward_click: function(){
            var self = this;
            var order  = this.pos.get_order();
            var client = order.get_client(); 
            if (!client) {
                this.screen_selector.set_current_screen('clientlist');
                return;
            }

            var rewards = order.get_available_rewards();
            if (rewards.length === 0) {
                this.screen_selector.show_popup('error',{
                    'message': 'No Rewards Available',
                    'comment': 'There are no rewards available for this customer as part of the loyalty program',
                });
                return;
            } else if (rewards.length === 1 && this.pos.loyalty.rewards.length === 1) {
                order.apply_reward(rewards[0]);
                return;
            } else {
                var list = [];
                for (var i = 0; i < rewards.length; i++) {
                    list.push({
                        label: rewards[i].name,
                        item:  rewards[i],
                    });
                }
                this.screen_selector.show_popup('selection',{
                    'message': 'Please select a reward',
                    'list': list,
                    'confirm': function(reward){
                        order.apply_reward(reward);
                    },
                });
            }
        },

        build_widgets: function(){
            var self = this;
            this._super();
            
            if(this.pos.loyalty && this.pos.loyalty.rewards.length ){
                var button = $(QWeb.render('LoyaltyButton'));
                button.click(function(){ self.loyalty_reward_click(); });
                button.appendTo(this.$('.control-buttons'));
                this.$('.control-buttons').removeClass('oe_hidden');
            }

        },
    });

    
    module.OrderWidget.include({
        update_summary: function(){
            this._super();

            var order = this.pos.get_order();

            var $loypoints = $(this.el).find('.summary .loyalty-points');

            if(this.pos.loyalty && order.get_client()){
                var points_won      = order.get_won_points();
                var points_spent    = order.get_spent_points();
                var points_total    = order.get_new_total_points(); 
                $loypoints.replaceWith($(QWeb.render('LoyaltyPoints',{ 
                    widget: this, 
                    rounding: this.pos.loyalty.rounding,
                    points_won: points_won,
                    points_spent: points_spent,
                    points_total: points_total,
                })));
                $loypoints = $(this.el).find('.summary .loyalty-points');
                $loypoints.removeClass('oe_hidden');

                if(points_total < 0){
                    $loypoints.addClass('negative');
                }else{
                    $loypoints.removeClass('negative');
                }
            }else{
                $loypoints.empty();
                $loypoints.addClass('oe_hidden');
            }
        },
    });
    
    module.PosWidget = module.PosWidget.extend({
        build_widgets: function() {
            this._super();

            this.selection_popup = new module.SelectionPopupWidget(this,{});
            this.selection_popup.appendTo(this.$el);

            this.textinput_popup = new module.TextInputPopupWidget(this,{});
            this.textinput_popup.appendTo(this.$el);

            this.textarea_popup = new module.TextAreaPopupWidget(this,{});
            this.textarea_popup.appendTo(this.$el);

            this.number_popup = new module.NumberPopupWidget(this,{});
            this.number_popup.appendTo(this.$el);

            this.password_popup = new module.PasswordPopupWidget(this,{});
            this.password_popup.appendTo(this.$el);

            this.unpaid_orders_popup = new module.UnpaidOrdersPopupWidget(this,{});
            this.unpaid_orders_popup.appendTo(this.$el);
            this.screen_selector.add_popup('textinput',this.textinput_popup);//EVUGOR
            this.screen_selector.add_popup('textarea',this.textarea_popup);//EVUGOR
            this.screen_selector.add_popup('number',this.number_popup);//EVUGOR
            this.screen_selector.add_popup('password',this.password_popup);//EVUGOR
            this.screen_selector.add_popup('selection',this.selection_popup);//EVUGOR
            this.screen_selector.add_popup('unpaid-orders',this.unpaid_orders_popup);//EVUGOR

//            this.screen_selector = new module.ScreenSelector({
//                pos: this.pos,
//                screen_set:{
//                    'products': this.product_screen,
//                    'payment' : this.payment_screen,
//                    'scale':    this.scale_screen,
//                    'receipt' : this.receipt_screen,
//                    'clientlist': this.clientlist_screen,
//                },
//                popup_set:{
//                    'error':            this.error_popup,
//                    'error-barcode':    this.error_barcode_popup,
//                    'error-traceback':  this.error_traceback_popup,
//                    'textinput':        this.textinput_popup,
//                    'textarea':         this.textarea_popup,
//                    'number':           this.number_popup,
//                    'password':         this.password_popup,
//                    'confirm':          this.confirm_popup,
//                    'selection':        this.selection_popup,
//                    'unsent-orders':    this.unsent_orders_popup,
//                    'unpaid-orders':    this.unpaid_orders_popup,
//                },
//                default_screen: 'products',
//                default_mode: 'cashier',
//            });
        },
        
    });
    
    module.SelectionPopupWidget = module.PopUpWidget.extend({
        template: 'SelectionPopupWidget',
        show: function(options){
            options = options || {};
            var self = this;
            this._super();

            this.message = options.message || '';
            this.list    = options.list    || [];
            this.renderElement();

            this.$('.button.cancel').click(function(){
                self.pos_widget.screen_selector.close_popup();
                if (options.cancel){
                    options.cancel.call(self);
                }
            });

            this.$('.selection-item').click(function(){
                self.pos_widget.screen_selector.close_popup();
                if (options.confirm) {
                    var item = self.list[parseInt($(this).data('item-index'))];
                    item = item ? item.item : item;
                    options.confirm.call(self,item);
                }
            });
        },
    });

    module.TextInputPopupWidget = module.PopUpWidget.extend({
        template: 'TextInputPopupWidget',
        show: function(options){
            options = options || {};
            var self = this;
            this._super();

            this.message = options.message || '';
            this.comment = options.comment || '';
            this.value   = options.value   || '';
            this.renderElement();
            this.$('input,textarea').focus();
            
            this.$('.button.cancel').click(function(){
                self.pos_widget.screen_selector.close_popup();
                if( options.cancel ){
                    options.cancel.call(self);
                }
            });

            this.$('.button.confirm').click(function(){
                self.pos_widget.screen_selector.close_popup();
                var value = self.$('input,textarea').val();
                if( options.confirm ){
                    options.confirm.call(self,value);
                }
            });
        },
    });

    module.TextAreaPopupWidget = module.TextInputPopupWidget.extend({
        template: 'TextAreaPopupWidget',
    });

    module.NumberPopupWidget = module.PopUpWidget.extend({
        template: 'NumberPopupWidget',
        click_numpad_button: function($el,event){
            this.numpad_input($el.data('action'));
        },
        numpad_input: function(input) { //FIXME -> Deduplicate code
            var oldbuf = this.inputbuffer.slice(0);

            if (input === '.') {
                if (this.firstinput) {
                    this.inputbuffer = "0.";
                }else if (!this.inputbuffer.length || this.inputbuffer === '-') {
                    this.inputbuffer += "0.";
                } else if (this.inputbuffer.indexOf('.') < 0){
                    this.inputbuffer = this.inputbuffer + '.';
                }
            } else if (input === 'CLEAR') {
                this.inputbuffer = ""; 
            } else if (input === 'BACKSPACE') { 
                this.inputbuffer = this.inputbuffer.substring(0,this.inputbuffer.length - 1);
            } else if (input === '+') {
                if ( this.inputbuffer[0] === '-' ) {
                    this.inputbuffer = this.inputbuffer.substring(1,this.inputbuffer.length);
                }
            } else if (input === '-') {
                if ( this.inputbuffer[0] === '-' ) {
                    this.inputbuffer = this.inputbuffer.substring(1,this.inputbuffer.length);
                } else {
                    this.inputbuffer = '-' + this.inputbuffer;
                }
            } else if (input[0] === '+' && !isNaN(parseFloat(input))) {
                this.inputbuffer = '' + ((parseFloat(this.inputbuffer) || 0) + parseFloat(input));
            } else if (!isNaN(parseInt(input))) {
                if (this.firstinput) {
                    this.inputbuffer = '' + input;
                } else {
                    this.inputbuffer += input;
                }
            }

            this.firstinput = this.inputbuffer.length === 0;

            if (this.inputbuffer !== oldbuf) {
                this.$('.value').text(this.inputbuffer);
            }
        },
        show: function(options){
            options = options || {};
            var self = this;
            this._super();

            this.message = options.message || '';
            this.comment = options.comment || '';
            this.inputbuffer = options.value   || '';
            this.renderElement();
            this.firstinput = true;
            
            this.$('.input-button,.mode-button').click(function(event){
                self.click_numpad_button($(this),event);
            });
            this.$('.button.cancel').click(function(){
                self.pos_widget.screen_selector.close_popup();
                if( options.cancel ){
                    options.cancel.call(self);
                }
            });

            this.$('.button.confirm').click(function(){
                self.pos_widget.screen_selector.close_popup();
                if( options.confirm ){
                    options.confirm.call(self,self.inputbuffer);
                }
            });
        },
    });

    module.PasswordPopupWidget = module.NumberPopupWidget.extend({
        renderElement: function(){
            this._super();
            this.$('.popup').addClass('popup-password');    // HELLO HACK !
        },
    });
    
    module.UnpaidOrdersPopupWidget = module.ConfirmPopupWidget.extend({
        template: 'UnpaidOrdersPopupWidget',
    });
    
    module.PosDB.include({
        save_unpaid_order: function(order){
            var order_id = order.uid;
            var orders = this.load('unpaid_orders',[]);
            var serialized = order.export_as_JSON();

            for (var i = 0; i < orders.length; i++) {
                if (orders[i].id === order_id){
                    orders[i].data = serialized;
                    this.save('unpaid_orders',orders);
                    return order_id;
                }
            }

            orders.push({id: order_id, data: serialized});
            this.save('unpaid_orders',orders);
            return order_id;
        },
        remove_unpaid_order: function(order){
            var orders = this.load('unpaid_orders',[]);
            orders = _.filter(orders, function(o){
                return o.id !== order.uid;
            });
            this.save('unpaid_orders',orders);
        },
        remove_all_unpaid_orders: function(){
            this.save('unpaid_orders',[]);
        },
        get_unpaid_orders: function(){
            var saved = this.load('unpaid_orders',[]);
            var orders = [];
            for (var i = 0; i < saved.length; i++) {
                orders.push(saved[i].data);
            }
            return orders;
        },
    });
    
    module.ReceiptScreenWidget = module.ReceiptScreenWidget.extend({
        refresh: function() {
            var self = this;
            this._super();
            
            var order = self.pos.get_order();
            //console.log(order);
            if(order.get_client()) {
                customer = order.get_client();
                //var street = '';
                var customer_loyalty_points = 0;
                var customer_name = '';
                if (customer != undefined){
                    customer_name = customer.name;

                    if(order.get_new_total_points()) {  
                        customer_loyalty_points = order.get_new_total_points();
                    }
                    //city=customer.city;                
                }
            
                self.$('.pos-receipt-container').html(QWeb.render('PosTicket',{
                    widget:self,
                    order: order,
                    receipt: order.export_for_printing(),
                    orderlines: order.get_orderlines(),
                    paymentlines: order.get_paymentlines(),
                    customer_name:customer_name,
                    customer_loyalty_points:customer_loyalty_points,
                    //city:city,
                }));
            }
        },
    });
    module.PosBaseWidget.include({
        format_pr_default: function(value,precision){
            var decimals = precision > 0 ? Math.max(0,Math.ceil(Math.log(1.0/precision) / Math.log(10))) : 0;
            return value.toFixed(decimals);
        },
    });
};

    
