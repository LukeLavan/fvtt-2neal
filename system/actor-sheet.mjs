export class TwoDotNealActorSheet extends ActorSheet {
    static get defaultOptions() {
        return mergeObject(super.defaultOptions, {
            classes: ['twodotneal', 'sheet', 'actor'],
            template: 'systems/fvtt-2neal/templates/actor-sheet.html',
            width: 640,
            height: 480,
            tabs: [
                {
                    navSelector: '.primary-tabs',
                    contentSelector: '.primary-content',
                    initial: 'basic',
                },
                {
                    navSelector: '.gear-tabs',
                    contentSelector: '.gear-content',
                },
            ],
        });
    }

    getData() {
        const context = super.getData();
        const actorData = context.actor.data;
        switch (actorData.type) {
            case 'pc':
                this._preparePCData(context);
                break;
        }
        context.rollData = context.actor.getRollData();
        return context;
    }

    _preparePCData(context) {
        context.alignmentChoices = {
            '(choose one)': '(choose one)',
            'Lawful Good': 'Lawful Good',
            'Lawful Neutral': 'Lawful Neutral',
            'Lawful Evil': 'Lawful Evil',
            'Neutral Good': 'Neutral Good',
            'Neutral Neutral': 'Neutral Neutral',
            'Neutral Evil': 'Neutral Evil',
            'Chaotic Good': 'Chaotic Good',
            'Chaotic Neutral': 'Chaotic Neutral',
            'Chaotic Evil': 'Chaotic Evil',
        };

        context.hitDieChoices = {
            d4: 'd4',
            d6: 'd6',
            d8: 'd8',
            d10: 'd10',
            d12: 'd12',
        };

        context.statChoices = {
            None: 'None',
            STR: 'STR',
            DEX: 'DEX',
            CON: 'CON',
            INT: 'INT',
            WIS: 'WIS',
            CHA: 'CHA',
            PER: 'PER',
        };

        context.attackTypeChoices = {
            '': '',
            Melee: 'Melee',
            Missile: 'Missile',
            Thrown: 'Thrown',
        };

        context.damageTypeChoices = {
            Bludgeoning: 'Bludg.',
            Slashing: 'Slash.',
            Piercing: 'Pierc.',
        };
    }

    activateListeners(html) {
        super.activateListeners(html);

        html.find('.rollable').click(this._rollRollable.bind(this));

        // item controls
        html.find('.item-create').click(this._itemCreate.bind(this));
        html.find('.item-edit').change(this._itemEdit.bind(this));
        html.find('.item-toggle').click(this._itemToggle.bind(this));
        html.find('.item-delete').click(this._itemDelete.bind(this));
        html.find('.item-open').click(this._itemOpen.bind(this));

        // gearTab controls
        html.find('.gearTab-delete').click(this._gearTabDelete.bind(this));
        html.find('.gearTab-defaultToggle').click(
            this._gearTabDefaultToggle.bind(this)
        );

        this._addItemTableListeners(html);

        html.find('.itemTable-sort').map((i, el) => {
            // eslint-disable-next-line no-undef
            Sortable.create(el, {
                setData: this._onStartDrag.bind(this),
                onUpdate: this._onUpdateDrag.bind(this),
                handle: '.itemTable-handle',
                filter: '[data-locked="true"]',
            });
        });

        // highlight active encumbrance
        const activeEncumbranceRow = html.find(
            '#encumbrance-' + this.actor.data.data.currentEncumbrance
        );
        if (activeEncumbranceRow[0])
            activeEncumbranceRow[0].className = 'encumbranceHighlight';
    }

    //TODO: better success/failure roll
    _rollRollable(event) {
        event.preventDefault();
        const element = event.currentTarget;
        const dataset = element.dataset;

        if (dataset.roll) {
            let roll = new Roll(dataset.roll, this.actor.data.data);
            let label = dataset.label ? `Rolling ${dataset.label}` : '';
            roll.toMessage({
                speaker: ChatMessage.getSpeaker({actor: this.actor}),
                flavor: label,
            });
        }
    }

    // create item with this ActorSheet's actor as parent
    async _itemCreate(event) {
        event.preventDefault();
        const currentTarget = event.currentTarget;
        const type = currentTarget.dataset.type;
        const data = duplicate(currentTarget.dataset);
        const itemName = type.capitalize();
        const itemData = {
            name: itemName,
            type: type,
            data: data,
        };
        const item = await Item.create(itemData, {parent: this.actor});
        const focusbox = document.getElementById(item.id + '.name');
        focusbox.focus();
        focusbox.select();
    }

    // edit an item's datum via an <input>
    _itemEdit(event) {
        const currentTarget = $(event.currentTarget);
        const id = currentTarget.parents('.item').data('item-id');
        const target = currentTarget.data('target');
        let value = currentTarget.val();
        // ensure checkbox values are booleans
        if (currentTarget.attr('type') === 'checkbox') {
            if (currentTarget.is(':checked')) value = true;
            else value = false;
        }
        let itemDifferential = {_id: id};
        itemDifferential[target] = value;
        this.actor.updateEmbeddedDocuments('Item', [itemDifferential]);
    }

    // updates all gearTabs' default status and updates actor's defaultGearTab
    _gearTabDefaultToggle(event) {
        const currentTarget = $(event.currentTarget);
        const id = currentTarget.parents('.item').data('item-id');
        const itemDifferentials = [];
        const actorData = this.object.data;
        actorData.data.gearTabs.forEach((_, key) => {
            if (key === id)
                itemDifferentials.push({
                    _id: key,
                    'data.default': true,
                });
            else
                itemDifferentials.push({
                    _id: key,
                    'data.default': false,
                });
        });

        this.object.update({'data.defaultGearTab': id});
        this.actor.updateEmbeddedDocuments('Item', itemDifferentials);
    }

    // toggles an item's boolean datum
    _itemToggle(event) {
        const currentTarget = $(event.currentTarget);
        const id = currentTarget.parents('.item').data('item-id');
        const target = currentTarget.data('target');
        let value = currentTarget.data('value');

        // toggle
        value = !value;

        let itemDifferential = {_id: id};
        itemDifferential[target] = value;

        this.actor.updateEmbeddedDocuments('Item', [itemDifferential]);
    }

    // deletes a single item
    _itemDelete(event) {
        const currentTarget = $(event.currentTarget);
        const id = currentTarget.parents('.item').data('item-id');
        const locked = currentTarget.data('locked');
        if (locked) return;
        this.actor.deleteEmbeddedDocuments('Item', [id]);
    }

    // deletes a gear tab and all items within
    _gearTabDelete(event) {
        const currentTarget = $(event.currentTarget);
        const id = currentTarget.parents('.item').data('item-id');
        const locked = currentTarget.data('locked');
        if (locked) return;
        const itemsToDelete = [id];
        // also delete items in tab
        this.actor.items.forEach((item) => {
            if (item.type === 'gear' && item.data.data.tab === id)
                itemsToDelete.push(item.id);
        });
        this.actor.deleteEmbeddedDocuments('Item', itemsToDelete);
    }

    // opens item's ItemSheet
    _itemOpen(event) {
        const currentTarget = $(event.currentTarget);
        const id = currentTarget.parents('.item').data('item-id');
        this.actor.data.items.get(id).sheet.render(true);
    }

    // pack data into dragTransfer for drop
    _onStartDrag(dataTransfer, dragEl) {
        const dragData = {
            actorId: this.actor.id,
            sceneId: this.actor.isToken ? canvas.scene?.id : null,
            tokenId: this.actor.isToken ? this.actor.token.id : null,
            pack: this.actor.pack,
        };
        if (dragEl.dataset.itemId) {
            const item = this.actor.items.get(dragEl.dataset.itemId);
            dragData.type = 'Item';
            dragData.data = item.data;
        }
        dataTransfer.setData('text/plain', JSON.stringify(dragData));
    }

    // update indices of newly sorted items
    _onUpdateDrag(event) {
        const children = event.to.children;
        const itemDifferentials = [];
        for (let i = 0; i < children.length; ++i)
            itemDifferentials.push({
                _id: children[i].dataset.itemId,
                'data.index': i,
            });
        this.actor.updateEmbeddedDocuments('Item', itemDifferentials);
    }

    // handles adding items to sheet via drag/drop
    _onDropItem(dragEvent, data) {
        const actorData = this.actor.data;
        const path = dragEvent.path;
        let target;
        for (let i = 0; i < path.length; ++i)
            if (path[i].classList?.contains('dragover')) target = path[i];
        const actorId = data.actorId;
        if (actorId === actorData._id) {
            // moving item within its parent actor
            if (target) {
                const itemDifferential = {_id: data.data._id};
                if (data.data.type === 'gear') {
                    itemDifferential['data.tab'] = target.dataset.tab;
                    itemDifferential['data.index'] = -1;
                }
                this.actor.updateEmbeddedDocuments('Item', [itemDifferential]);
            }
        } else {
            // cloning item from outside parent actor
            let item;
            if (actorId) {
                // item belongs to a different actor
                const srcActor = game.actors.get(data.actorId);
                item = srcActor.data.items.get(data.data._id);
                item.data.data.index = -1;
            }
            // item does not belong to an actor
            else item = game.items.get(data.id);
            if (item.type === 'gear') {
                let targetTab = actorData.data.defaultGearTab;
                if (target) targetTab = target.dataset.tab;
                item.data.data.tab = targetTab;
                item.data.data.index = -1;
            }
            Item.create(
                {
                    name: item.name,
                    type: item.type,
                    data: item.data.data,
                },
                {
                    parent: this.actor,
                }
            );
        }
    }

    // attaches listeners for itemTable drag/drop
    _addItemTableListeners(html) {
        const draggableRows = html.find('.itemTable-draggable-row');
        // prevent moving item to its current tab by removing droppable class from div and label
        draggableRows.on('dragstart', (event) => {
            const currentTarget = $(event.currentTarget);
            const tabID = currentTarget.parents('.tab').data('item-id');
            const tabLabel = $('a.item.navbar-item[data-tab=' + tabID + ']');
            currentTarget.parents('.tab.item').removeClass('droppable');
            tabLabel.removeClass('droppable');
        });

        // restore droppable class to current tab div + label
        draggableRows.on('dragend', (event) => {
            const currentTarget = $(event.currentTarget);
            const tabID = currentTarget.parents('.tab').data('item-id');
            const tabLabel = $('a.item.navbar-item[data-tab=' + tabID + ']');
            currentTarget.parents('.tab.item').addClass('droppable');
            tabLabel.addClass('droppable');
        });

        const droppables = html.find('.droppable');
        // add dragover class for valid drop targets
        droppables.on('dragover', (event) => {
            const currentTarget = $(event.currentTarget);
            if (currentTarget.hasClass('droppable'))
                currentTarget.addClass('dragover');
        });
        // remove dragover class
        droppables.on('dragleave', (event) => {
            event.currentTarget.classList.remove('dragover');
        });
        // no need to remove class on drop event, since successful drop re-renders sheet
    }
}
